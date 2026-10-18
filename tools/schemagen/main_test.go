package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// plugin writes a one-file plugin named name, reading its configuration as
// plugins have since collage v0.50.0, into a fresh directory and parses it.
func plugin(t *testing.T, name, body string) (*pkg, error) {
	t.Helper()
	return pluginReading(t, name, "func (p *Plugin) Configure(host ConfigHost) (err error) {\n\tp.cfg, err = collage.PluginConfig(host, p.cfg)\n\treturn err\n}", body)
}

// pluginReading is plugin with configure as the method reading the configuration.
func pluginReading(t *testing.T, name, configure, body string) (*pkg, error) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "collage-"+strings.TrimPrefix(name, "elagoht/"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	src := "package p\n\nconst Name = \"" + name + "\"\n\nfunc (p *Plugin) Name() string { return Name }\n\n" +
		configure + "\n\n" + body
	if err := os.WriteFile(filepath.Join(dir, "p.go"), []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	return parse(dir)
}

func property(t *testing.T, p *pkg, key string) string {
	t.Helper()
	s := p.schema()
	if len(p.errs) > 0 {
		t.Fatalf("schema: %v", p.errs)
	}
	body, err := json.Marshal(s.Properties[key])
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

// A type that decodes itself takes whatever its UnmarshalJSON reads, which its
// underlying Go type does not say: opti-image's WebPMode is a uint8 read from
// true, false or "auto". A collage.Duration is a duration string.
func TestATypeThatDecodesItselfIsDescribedByItsDecoder(t *testing.T) {
	p, err := plugin(t, "elagoht/opti-image", `
type Options struct {
	WebP WebPMode `+"`json:\"webp\"`"+`
	FetchTimeout collage.Duration `+"`json:\"fetchTimeout\"`"+`
}
type WebPMode uint8
func (m *WebPMode) UnmarshalJSON(data []byte) error { return nil }
`)
	if err != nil {
		t.Fatal(err)
	}
	if got := property(t, p, "webp"); !strings.Contains(got, `"anyOf":[{"type":"boolean"},{"type":"string","enum":["auto"]}]`) {
		t.Errorf("webp = %s, want true, false or \"auto\"", got)
	}
	// collage.Duration (collage v0.61.0) is a duration string and refuses a number.
	if got := property(t, p, "fetchTimeout"); !strings.Contains(got, `"type":"string"`) || strings.Contains(got, `"integer"`) {
		t.Errorf("fetchTimeout = %s, want a duration string only", got)
	}
}

// A decoder the generator has no entry for stops it: guessing from the Go type
// is how webp came to be an integer.
func TestAnUnknownDecoderIsAnError(t *testing.T) {
	p, err := plugin(t, "elagoht/newone", `
type Config struct {
	Mode Mode `+"`json:\"mode\"`"+`
}
type Mode int
func (m *Mode) UnmarshalJSON(data []byte) error { return nil }
`)
	if err != nil {
		t.Fatal(err)
	}
	p.schema()
	if len(p.errs) != 1 || !strings.Contains(p.errs[0].Error(), "elagoht/newone.Mode") {
		t.Errorf("errs = %v, want one naming elagoht/newone.Mode", p.errs)
	}
}

// A type without its own decoder is what encoding/json makes of it.
func TestATypeWithoutADecoderIsItsUnderlyingType(t *testing.T) {
	p, err := plugin(t, "elagoht/plain", `
type Config struct {
	Wait Duration `+"`json:\"wait\"`"+`
}
type Duration int64
`)
	if err != nil {
		t.Fatal(err)
	}
	if got := property(t, p, "wait"); !strings.Contains(got, `"type":"integer"`) {
		t.Errorf("wait = %s, want an integer: nothing reads \"2s\" for it", got)
	}
}

// A plugin written before collage v0.50.0 decoded its configuration with
// host.Config; its Config is still its schema.
func TestHostConfigStillCounts(t *testing.T) {
	p, err := pluginReading(t, "elagoht/old", "func (p *Plugin) Configure(host Host) error { return host.Config(&p.cfg) }", `
type Config struct {
	Name string `+"`json:\"name\"`"+`
}
`)
	if err != nil {
		t.Fatal(err)
	}
	if got := property(t, p, "name"); !strings.Contains(got, `"type":"string"`) {
		t.Errorf("name = %s, want a string", got)
	}
}

// A library naming itself with a Name constant but serving no Plugin, as
// collage-redis does, has no key in plugins-config.json.
func TestALibraryWithANameConstantIsNotAPlugin(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "collage-lib")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	src := "package lib\n\nconst Name = \"elagoht/lib\"\n\ntype Store struct{}\n"
	if err := os.WriteFile(filepath.Join(dir, "lib.go"), []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	p, err := parse(dir)
	if err != nil {
		t.Fatal(err)
	}
	if p != nil {
		t.Errorf("parse = %q, want no plugin", p.name)
	}
}

// A plugin that reads no configuration has no schema: its Options are Go-only.
func TestAPluginReadingNoConfigurationHasNoProperties(t *testing.T) {
	p, err := pluginReading(t, "elagoht/none", "", `
type Options struct {
	Name string
}
`)
	if err != nil {
		t.Fatal(err)
	}
	if s := p.schema(); len(s.Properties) != 0 {
		t.Errorf("properties = %v, want none", s.Properties)
	}
}

// requires, order and setup are written by hand in each plugin repo: a
// regenerated manifest keeps them.
func TestRegeneratingAManifestKeepsRequiresOrderAndSetup(t *testing.T) {
	p, err := plugin(t, "elagoht/websocket", `
type Options struct {
	Path string `+"`json:\"path\"`"+`
}
`)
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(t.TempDir(), "collage-websocket")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	old := `{
  "name": "elagoht/websocket",
  "requires": ["elagoht/live"],
  "order": -1,
  "setup": "Give it to ` + "`websocket.New(websocket.Options{})`" + ` in <plugins.go>.",
  "description": "stale"
}
`
	if err := os.WriteFile(filepath.Join(dir, "collage.json"), []byte(old), 0o644); err != nil {
		t.Fatal(err)
	}
	catalog := filepath.Join(t.TempDir(), "catalog.json")
	snippets := filepath.Join(t.TempDir(), "html.json")
	if err := os.WriteFile(catalog, []byte(`{"functions":[],"attributes":[]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(snippets, []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := writeManifest(dir, p, p.schema(), catalog, snippets); err != nil {
		t.Fatal(err)
	}
	body, err := os.ReadFile(filepath.Join(dir, "collage.json"))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Name        string   `json:"name"`
		Requires    []string `json:"requires"`
		Order       *int     `json:"order"`
		Setup       string   `json:"setup"`
		Description string   `json:"description"`
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Requires) != 1 || got.Requires[0] != "elagoht/live" {
		t.Errorf("requires = %v, want [elagoht/live]", got.Requires)
	}
	if got.Order == nil || *got.Order != -1 {
		t.Errorf("order = %v, want -1", got.Order)
	}
	if want := "Give it to `websocket.New(websocket.Options{})` in <plugins.go>."; got.Setup != want {
		t.Errorf("setup = %q, want %q", got.Setup, want)
	}
	if got.Description == "stale" {
		t.Errorf("description was kept; the rest is regenerated")
	}
}

// A manifest without them, or no manifest yet, gains none.
func TestANewManifestHasNoRequiresOrderOrSetup(t *testing.T) {
	p, err := plugin(t, "elagoht/plain", "")
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	catalog := filepath.Join(t.TempDir(), "catalog.json")
	snippets := filepath.Join(t.TempDir(), "html.json")
	if err := os.WriteFile(catalog, []byte(`{"functions":[],"attributes":[]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(snippets, []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := writeManifest(dir, p, p.schema(), catalog, snippets); err != nil {
		t.Fatal(err)
	}
	body, err := os.ReadFile(filepath.Join(dir, "collage.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{`"requires"`, `"order"`, `"setup"`} {
		if strings.Contains(string(body), key) {
			t.Errorf("collage.json has %s:\n%s", key, body)
		}
	}
}

// collage.Duration (collage v0.61.0) is a string only: a number is refused when
// the plugin decodes it, so the schema must not offer one.
func TestCollageDurationIsAString(t *testing.T) {
	p, err := plugin(t, "elagoht/fail2ban", `
type Options struct {
	BanTime collage.Duration `+"`json:\"banTime\"`"+`
}
`)
	if err != nil {
		t.Fatal(err)
	}
	got := property(t, p, "banTime")
	if !strings.Contains(got, `"type":"string"`) || !strings.Contains(got, `"pattern"`) || strings.Contains(got, "integer") {
		t.Errorf("banTime = %s, want a duration string and no number", got)
	}
}
