// Command schemagen writes the JSON Schema of plugins-config.json from the
// plugins' own source: each plugin's Name constant is a key, and its Options (or
// Config) struct — the one it decodes with host.Config — is that key's schema,
// field comments included. Generated rather than written, so it cannot drift from
// the plugins.
//
//	go run ./tools/schemagen -src ~/Desktop -out schemas/plugins-config.schema.json
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// schema is a JSON Schema node. Only what the generated file uses.
type schema struct {
	Type                 string             `json:"type,omitempty"`
	Description          string             `json:"description,omitempty"`
	Properties           map[string]*schema `json:"properties,omitempty"`
	AdditionalProperties *schema            `json:"-"`
	// Closed forbids properties the schema does not name: a misspelt key in a
	// plugin's section is flagged rather than silently ignored, as collage
	// ignores it.
	Closed   bool      `json:"-"`
	Items    *schema   `json:"items,omitempty"`
	AnyOf    []*schema `json:"anyOf,omitempty"`
	Enum     []string  `json:"enum,omitempty"`
	Pattern  string    `json:"pattern,omitempty"`
	Examples []string  `json:"examples,omitempty"`
	Link     string    `json:"markdownDescription,omitempty"`
}

// MarshalJSON writes additionalProperties as a schema, as false for a closed
// object, or not at all.
func (s *schema) MarshalJSON() ([]byte, error) {
	type plain schema
	body, err := json.Marshal((*plain)(s))
	if err != nil {
		return nil, err
	}
	var extra []byte
	switch {
	case s.AdditionalProperties != nil:
		if extra, err = json.Marshal(s.AdditionalProperties); err != nil {
			return nil, err
		}
	case s.Closed:
		extra = []byte("false")
	default:
		return body, nil
	}
	return append(append(body[:len(body)-1], []byte(`,"additionalProperties":`)...), append(extra, '}')...), nil
}

// pkg is one plugin package, parsed.
type pkg struct {
	name   string // the plugin's Name constant
	doc    string
	types  map[string]*ast.TypeSpec
	consts map[string][]string // named string type -> its constant values
	repo   string
	// reads reports that the plugin decodes its configuration with host.Config:
	// without it, an Options struct is Go-only, whatever its fields look like.
	reads bool
	// decodes holds the types with their own UnmarshalJSON, whose JSON form their
	// Go type does not tell.
	decodes map[string]bool
	// errs collects what the schema could not be made of: a decoder with no entry
	// in decoders.
	errs []error
}

// durationPattern is what time.ParseDuration reads: "25s", "1m30s".
const durationPattern = `^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$`

// decoders are the JSON forms of the plugins' types that decode themselves,
// keyed "<plugin name>.<type>", written from each type's UnmarshalJSON. A type
// with a decoder and no entry here stops the generator: guessing from its Go type
// is how opti-image's webp, a uint8 read from true, false or "auto", came to be
// an integer that rejected every valid value.
var decoders = map[string]func() *schema{
	"elagoht/opti-image.WebPMode": func() *schema {
		return &schema{AnyOf: []*schema{{Type: "boolean"}, {Type: "string", Enum: []string{"auto"}}}}
	},
	"elagoht/opti-image.Duration": durationOrNanoseconds,
	"elagoht/cdnpurge.Duration":   durationOrNanoseconds,
	"elagoht/ogimage.Duration":    durationOrNanoseconds,
	"elagoht/tenant.Duration":     durationOrNanoseconds,
	"elagoht/live.Duration": func() *schema {
		return &schema{Type: "string", Pattern: durationPattern, Examples: []string{"30s", "5m"}}
	},
}

// durationOrNanoseconds is a duration written as Go writes one, "10s", or a
// number of nanoseconds.
func durationOrNanoseconds() *schema {
	return &schema{AnyOf: []*schema{
		{Type: "string", Pattern: durationPattern, Examples: []string{"30s", "5m"}},
		{Type: "integer", Description: "nanoseconds"},
	}}
}

func main() {
	src := flag.String("src", filepath.Join(os.Getenv("HOME"), "Desktop"), "directory holding the collage-* plugin repos")
	out := flag.String("out", "schemas/plugins-config.schema.json", "file to write")
	manifests := flag.Bool("manifests", false, "also write each plugin repo's collage.json, from the catalog, the snippets and its schema")
	catalogPath := flag.String("catalog", "../../data/catalog.json", "the catalog, for -manifests")
	snippetsPath := flag.String("snippets", "../../snippets/html.json", "the template snippets, for -manifests")
	flag.Parse()

	dirs, err := filepath.Glob(filepath.Join(*src, "collage-*"))
	if err != nil {
		fail(err)
	}
	root := &schema{
		Type:        "object",
		Description: "Plugin configuration for a collage application, keyed by plugin name. Loaded with collage.LoadPluginConfig and passed as Config.PluginConfig.",
		Properties:  map[string]*schema{},
		// A plugin not generated here — your own, a third party's — is still
		// welcome under its own key.
		AdditionalProperties: &schema{Type: "object"},
	}
	for _, dir := range dirs {
		p, err := parse(dir)
		if err != nil {
			fail(err)
		}
		if p == nil {
			continue // not a plugin: the docs site, this repo, the framework
		}
		root.Properties[p.name] = p.schema()
		if len(p.errs) > 0 {
			fail(errors.Join(p.errs...))
		}
		if *manifests {
			if err := writeManifest(dir, p, root.Properties[p.name], *catalogPath, *snippetsPath); err != nil {
				fail(err)
			}
		}
	}
	body, err := json.MarshalIndent(struct {
		Schema string `json:"$schema"`
		ID     string `json:"$id"`
		*schema
	}{"http://json-schema.org/draft-07/schema#", "https://collage.furkanbaytekin.dev/schemas/plugins-config.json", root}, "", "  ")
	if err != nil {
		fail(err)
	}
	if err := os.WriteFile(*out, append(body, '\n'), 0o644); err != nil {
		fail(err)
	}
	fmt.Printf("schema: %d plugins\n", len(root.Properties))
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "schemagen:", err)
	os.Exit(1)
}

// parse reads the plugin in dir, or returns nil when dir holds none.
func parse(dir string) (*pkg, error) {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, dir, func(fi os.FileInfo) bool { return !strings.HasSuffix(fi.Name(), "_test.go") }, parser.ParseComments)
	if err != nil {
		return nil, err
	}
	for pkgName, astPkg := range pkgs {
		if pkgName == "main" {
			continue
		}
		p := &pkg{types: map[string]*ast.TypeSpec{}, consts: map[string][]string{}, decodes: map[string]bool{}, repo: filepath.Base(dir)}
		for _, file := range astPkg.Files {
			ast.Inspect(file, func(n ast.Node) bool {
				if call, ok := n.(*ast.CallExpr); ok {
					if sel, ok := call.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Config" && len(call.Args) == 1 {
						if u, ok := call.Args[0].(*ast.UnaryExpr); ok && u.Op == token.AND {
							p.reads = true
						}
					}
				}
				return true
			})
			if file.Doc != nil && p.doc == "" {
				p.doc = firstSentence(file.Doc.Text())
			}
			for _, decl := range file.Decls {
				if fn, ok := decl.(*ast.FuncDecl); ok && fn.Name.Name == "UnmarshalJSON" && fn.Recv != nil && len(fn.Recv.List) == 1 {
					recv := fn.Recv.List[0].Type
					if star, ok := recv.(*ast.StarExpr); ok {
						recv = star.X
					}
					if id, ok := recv.(*ast.Ident); ok {
						p.decodes[id.Name] = true
					}
				}
				gen, ok := decl.(*ast.GenDecl)
				if !ok {
					continue
				}
				for _, spec := range gen.Specs {
					switch s := spec.(type) {
					case *ast.TypeSpec:
						p.types[s.Name.Name] = s
					case *ast.ValueSpec:
						if gen.Tok != token.CONST {
							continue
						}
						for i, n := range s.Names {
							if i >= len(s.Values) {
								continue
							}
							lit, ok := s.Values[i].(*ast.BasicLit)
							if !ok || lit.Kind != token.STRING {
								continue
							}
							v, _ := strconv.Unquote(lit.Value)
							if n.Name == "Name" && strings.Contains(v, "/") {
								p.name = v
							}
							if id, ok := s.Type.(*ast.Ident); ok {
								p.consts[id.Name] = append(p.consts[id.Name], v)
							}
						}
					}
				}
			}
		}
		if p.name != "" {
			return p, nil
		}
	}
	return nil, nil
}

func firstSentence(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	// "Package live is a collage plugin that…" reads, in an editor's tooltip,
	// better as "A collage plugin that…".
	if strings.HasPrefix(s, "Package ") {
		if i := strings.Index(s, " is "); i > 0 {
			s = strings.ToUpper(s[i+4:i+5]) + s[i+5:]
		}
	}
	if i := strings.Index(s, ". "); i > 0 {
		return s[:i+1]
	}
	return s
}

// schema is the plugin's configuration object.
func (p *pkg) schema() *schema {
	out := &schema{Type: "object", Description: p.doc, Properties: map[string]*schema{}, Closed: true}
	out.Link = p.doc + "\n\n[" + p.repo + "](https://github.com/Elagoht/" + p.repo + ")"
	for _, name := range []string{"Options", "Config"} {
		if !p.reads {
			break
		}
		if spec, ok := p.types[name]; ok {
			if st, ok := spec.Type.(*ast.StructType); ok {
				p.fields(st, out)
				break
			}
		}
	}
	if len(out.Properties) == 0 {
		out.Description += " It takes no configuration from JSON: it is configured in Go."
		out.Link += "\n\nIt takes no configuration from JSON: it is configured in Go."
	}
	return out
}

// fields adds the JSON-decodable fields of st to obj.
func (p *pkg) fields(st *ast.StructType, obj *schema) {
	for _, f := range st.Fields.List {
		if len(f.Names) == 0 {
			continue // embedded
		}
		key := f.Names[0].Name
		if !ast.IsExported(key) {
			continue
		}
		if f.Tag != nil {
			tag, _ := strconv.Unquote(f.Tag.Value)
			if j, ok := lookupTag(tag, "json"); ok {
				j = strings.Split(j, ",")[0]
				if j == "-" {
					continue
				}
				if j != "" {
					key = j
				}
			}
		}
		s := p.typeSchema(f.Type, 0)
		if doc := fieldDoc(f); doc != "" {
			s.Description = doc
		}
		obj.Properties[key] = s
	}
}

func lookupTag(tag, key string) (string, bool) {
	for tag != "" {
		i := strings.Index(tag, ":\"")
		if i < 0 {
			return "", false
		}
		name := strings.TrimSpace(tag[:i])
		rest := tag[i+2:]
		j := strings.Index(rest, "\"")
		if j < 0 {
			return "", false
		}
		if name == key {
			return rest[:j], true
		}
		tag = strings.TrimSpace(rest[j+1:])
	}
	return "", false
}

func fieldDoc(f *ast.Field) string {
	var parts []string
	if f.Doc != nil {
		parts = append(parts, f.Doc.Text())
	}
	if f.Comment != nil {
		parts = append(parts, f.Comment.Text())
	}
	return strings.Join(strings.Fields(strings.Join(parts, " ")), " ")
}

// typeSchema maps a Go type to its JSON form, as encoding/json decodes it.
func (p *pkg) typeSchema(expr ast.Expr, depth int) *schema {
	if depth > 6 {
		return &schema{}
	}
	switch t := expr.(type) {
	case *ast.StarExpr:
		return p.typeSchema(t.X, depth+1)
	case *ast.ArrayType:
		if id, ok := t.Elt.(*ast.Ident); ok && id.Name == "byte" {
			return &schema{Type: "string", Description: "base64"}
		}
		return &schema{Type: "array", Items: p.typeSchema(t.Elt, depth+1)}
	case *ast.MapType:
		return &schema{Type: "object", AdditionalProperties: p.typeSchema(t.Value, depth+1)}
	case *ast.SelectorExpr:
		if x, ok := t.X.(*ast.Ident); ok && x.Name == "time" && t.Sel.Name == "Duration" {
			return &schema{Type: "integer", Description: "nanoseconds"}
		}
		return &schema{}
	case *ast.StructType:
		obj := &schema{Type: "object", Properties: map[string]*schema{}, Closed: true}
		p.fields(t, obj)
		return obj
	case *ast.Ident:
		switch t.Name {
		case "string":
			return &schema{Type: "string"}
		case "bool":
			return &schema{Type: "boolean"}
		case "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64":
			return &schema{Type: "integer"}
		case "float32", "float64":
			return &schema{Type: "number"}
		}
		spec, ok := p.types[t.Name]
		if !ok {
			return &schema{}
		}
		if p.decodes[t.Name] {
			key := p.name + "." + t.Name
			decoder, ok := decoders[key]
			if !ok {
				p.errs = append(p.errs, fmt.Errorf("%s decodes itself with UnmarshalJSON; add what it reads to decoders", key))
				return &schema{}
			}
			return decoder()
		}
		s := p.typeSchema(spec.Type, depth+1)
		if values := p.consts[t.Name]; len(values) > 0 && s.Type == "string" {
			sort.Strings(values)
			s.Enum = values
		}
		return s
	}
	return &schema{}
}

// catalogFile is the part of data/catalog.json a manifest is made from.
type catalogFile struct {
	Functions []struct {
		Name      string `json:"name"`
		Source    string `json:"source"`
		Signature string `json:"signature"`
		Insert    string `json:"insert"`
		Doc       string `json:"doc"`
		Repo      string `json:"repo"`
	} `json:"functions"`
	Attributes []struct {
		Name  string  `json:"name"`
		Value *string `json:"value"`
		Doc   string  `json:"doc"`
		Repo  string  `json:"repo"`
	} `json:"attributes"`
}

type snippet struct {
	Language    string   `json:"language"`
	Prefix      string   `json:"prefix"`
	Body        []string `json:"body"`
	Description string   `json:"description,omitempty"`
}

type manifestFunc struct {
	Name      string `json:"name"`
	Signature string `json:"signature"`
	Insert    string `json:"insert,omitempty"`
	Doc       string `json:"doc"`
}

type manifestAttr struct {
	Name  string  `json:"name"`
	Value *string `json:"value"`
	Doc   string  `json:"doc"`
}

type manifest struct {
	Schema            string             `json:"$schema"`
	Name              string             `json:"name"`
	Description       string             `json:"description,omitempty"`
	Repository        string             `json:"repository"`
	TemplateFunctions []manifestFunc     `json:"templateFunctions,omitempty"`
	Attributes        []manifestAttr     `json:"attributes,omitempty"`
	Snippets          map[string]snippet `json:"snippets,omitempty"`
	Config            *schema            `json:"config,omitempty"`
}

// writeManifest writes dir/collage.json: the plugin's template functions and
// attributes from the catalog, its template snippets — those whose name begins
// with its repository's — and its configuration's schema.
func writeManifest(dir string, p *pkg, config *schema, catalogPath, snippetsPath string) error {
	var cat catalogFile
	if err := readJSON(catalogPath, &cat); err != nil {
		return err
	}
	var snippets map[string]snippet
	if err := readJSON(snippetsPath, &snippets); err != nil {
		return err
	}
	m := manifest{
		Schema:      "https://raw.githubusercontent.com/Elagoht/collage-snippets-highlighter/main/schemas/collage-plugin-manifest.schema.json",
		Name:        p.name,
		Description: p.doc,
		Repository:  "https://github.com/Elagoht/" + p.repo,
	}
	for _, f := range cat.Functions {
		if f.Repo == p.repo {
			m.TemplateFunctions = append(m.TemplateFunctions, manifestFunc{Name: f.Name, Signature: f.Signature, Insert: f.Insert, Doc: f.Doc})
		}
	}
	for _, a := range cat.Attributes {
		if a.Repo == p.repo {
			m.Attributes = append(m.Attributes, manifestAttr{Name: a.Name, Value: a.Value, Doc: a.Doc})
		}
	}
	for name, sn := range snippets {
		if strings.HasPrefix(name, p.repo) {
			if m.Snippets == nil {
				m.Snippets = map[string]snippet{}
			}
			sn.Language = "html"
			m.Snippets[name] = sn
		}
	}
	if len(config.Properties) > 0 {
		c := *config
		c.Link = ""
		m.Config = &c
	}
	// Snippet bodies are markup: escaping <, > and & would make them unreadable.
	var buf strings.Builder
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(m); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "collage.json"), []byte(buf.String()), 0o644)
}

func readJSON(path string, v any) error { // any: encoding/json's own parameter type
	body, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}
