// The Go snippets that use an import — a whole function, or the lines of one —
// and what a file needs above one to compile: its package clause and its imports.
// Kept free of the vscode API so the rules can be tested in Node.
import * as path from "path";

export const COLLAGE_IMPORT = "github.com/Elagoht/collage/pkg/collage";
const VALIDATE = "github.com/Elagoht/collage-validate";
const FLASH = "github.com/Elagoht/collage-flash";
const META = "github.com/Elagoht/collage-meta";
const JSONLD = "github.com/Elagoht/collage-jsonld";
const COLLAGETEST = "github.com/Elagoht/collage/pkg/collagetest";

/** A snippet the extension offers in Go, with the imports its body uses. */
export interface FunctionSnippet {
  prefix: string;
  description: string;
  body: string[];
  imports: string[];
}

// The snippets follow the layout `collage new` scaffolds and `collage add` writes:
// pages/<area>/<name>.go builds a page, fragments/pages/<area>/<name>.go its
// content, fragments/layouts the layouts, actions/<area>.go the action builders and
// actions/funcs/<area>.go their handlers, documents/ and data/<domain>/ the rest.
// Exported functions carry a one-line comment, a signature with more than one
// parameter takes a line for each, and data is typed: a view struct, never any.
// Placeholders name what goes in them, never an example domain: ${1:name} is the
// name a page, fragment or action is registered under, ${2:Name} the Go function
// returning it, ${3:service} ${4:*domain.Service} a dependency handed in. The
// same number is the same text, typed once.
export const functionSnippets: FunctionSnippet[] = [
  // pages/<area>/<name>.go
  {
    prefix: "cpage",
    description: "collage: a page — its layout, content and path (pages/<area>/<name>.go)",
    body: [
      "// Returns the ${1:name} page: its layout, content and path.",
      "func ${2:Name}() *collage.Page {",
      "\treturn collage.NewPage(\"${1:name}\").",
      "\t\tWithLayouts(layouts.${3:Layout}()).",
      "\t\tWithContent(fragments.${2:Name}()).",
      "\t\tWithPath(\"${4:en}\", \"${5:/path}\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cpagea",
    description: "collage: a page with the action its form posts to, attached at its URL",
    body: [
      "// Returns the ${1:name} page, with the action its form posts to.",
      "func ${2:Name}(",
      "\t${3:service} ${4:*domain.Service},",
      ") *collage.Page {",
      "\treturn collage.NewPage(\"${1:name}\").",
      "\t\tWithLayouts(layouts.${5:Layout}()).",
      "\t\tWithContent(fragments.${2:Name}()).",
      "\t\tWithPath(\"${6:en}\", \"${7:/path}\").",
      "\t\tWithActionFor(actions.${2:Name}(${3:service})).",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cpagep",
    description: "collage: a page at a path with a parameter, its content Required so a missing record is a 404",
    body: [
      "// Returns the ${1:name} page, one per ${2:id}.",
      "func ${3:Name}(",
      "\t${4:service} ${5:*domain.Service},",
      ") *collage.Page {",
      "\treturn collage.NewPage(\"${1:name}\").",
      "\t\tWithLayouts(layouts.${6:Layout}()).",
      "\t\tWithContent(fragments.${3:Name}(${4:service})).",
      "\t\tWithPath(\"${7:en}\", \"${8:/path}/{${2:id}}\").",
      "\t\tDynamic().",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cpage404",
    description: "collage: the not-found page — register it with RegisterNotFoundPage, not with a path",
    body: [
      "// Returns the page every unknown address answers with.",
      "func NotFoundPage() *collage.Page {",
      "\treturn collage.NewPage(\"not-found\").",
      "\t\tWithLayouts(layouts.${1:Layout}()).",
      "\t\tWithContent(fragments.NotFound()).",
      "\t\tDynamic().",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },

  // fragments/pages/<area>/<name>.go
  {
    prefix: "cfrag",
    description: "collage: a page's content — an inline template, its view and a typed data handler (fragments/pages/<area>/<name>.go)",
    body: [
      "// Types data used on this page.",
      "type ${1:name}View struct {",
      "\t${2:Title string}",
      "}",
      "",
      "// Returns the ${1:name} page's content.",
      "func ${3:Name}() *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${1:name}\", ${1:name}Block).",
      "\t\tWithData(collage.Load(${1:name}Data)).",
      "\t\tBuild()",
      "}",
      "",
      "const ${1:name}Block collage.InlineHTML = `<main>",
      "  ${4:<h1>{{.Title\\}\\}</h1>}",
      "</main>`",
      "",
      "// Reads what this page renders.",
      "func ${1:name}Data(",
      "\t_ context.Context,",
      "\trc *collage.RenderContext,",
      ") (${1:name}View, error) {",
      "\trc.HoistTitle(\"${5:Title}\")",
      "\t$0",
      "\treturn ${1:name}View{${6:Title: \"${5:Title}\"}}, nil",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cfragf",
    description: "collage: a fragment whose template is a file under the template root",
    body: [
      "// Returns the ${1:name} fragment, templates/${2:components/$1}.html.",
      "func ${3:Name}() *collage.Fragment {",
      "\treturn collage.NewFragment(\"${1:name}\", \"${2:components/$1}.html\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cfragd",
    description: "collage: a fragment whose data handler needs a service — the handler is a factory taking it and returning collage.Data",
    body: [
      "// Returns the ${1:name} content, read through ${2:service}.",
      "func ${3:Name}(",
      "\t${2:service} ${4:*domain.Service},",
      ") *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${1:name}\", ${1:name}Block).",
      "\t\tWithData(${1:name}Data(${2:service})).",
      "\t\tRequired().",
      "\t\tBuild()",
      "}",
      "",
      "const ${1:name}Block collage.InlineHTML = `${5:<h1>{{.Title\\}\\}</h1>}`",
      "",
      "// Types data used on this page.",
      "type ${1:name}View struct {",
      "\t${6:Title string}",
      "}",
      "",
      "// Reads the record the path names; a missing one is a 404.",
      "func ${1:name}Data(",
      "\t${2:service} ${4:*domain.Service},",
      ") collage.Data {",
      "\treturn collage.Load(func(",
      "\t\tctx context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (${1:name}View, error) {",
      "\t\t$0",
      "\t\treturn ${1:name}View{}, nil",
      "\t})",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cfrags",
    description: "collage: a fragment whose slot is filled per render, with the resolver that picks what goes in it",
    body: [
      "// Returns the ${1:name} content, with its ${2:slot} slot chosen per render.",
      "func ${3:Name}() *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${1:name}\", `{{slot \"${2:slot}\"\\}\\}`).",
      "\t\tWithSlotResolver(\"${2:slot}\", resolve${4:Slot}).",
      "\t\tBuild()",
      "}",
      "",
      "// Picks the fragments that fill the ${2:slot} slot for this render.",
      "func resolve${4:Slot}(",
      "\trc *collage.RenderContext,",
      ") ([]*collage.Fragment, error) {",
      "\tif ${5:condition(rc)} {",
      "\t\treturn []*collage.Fragment{${6:first}}, nil",
      "\t}",
      "\treturn []*collage.Fragment{${7:otherwise}}, nil",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cfrag404",
    description: "collage: the not-found page's content",
    body: [
      "// Returns the content of the page every unknown address answers with.",
      "func NotFound() *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"not-found\", notFoundBlock).Build()",
      "}",
      "",
      "const notFoundBlock collage.InlineHTML = `<main>",
      "  <h1>${1:Not found}</h1>",
      "  <p><a href=\"{{pageURL \"${2:home}\"\\}\\}\">${3:Back to the home page}</a></p>",
      "</main>`",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "chtml",
    description: "collage: an inline template as a constant, edited and coloured as HTML",
    body: ["const ${1:name}Block collage.InlineHTML = `", "$0", "`"],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cload",
    description: "collage: a typed data handler, with collage.Load — WithData's argument",
    body: [
      "collage.Load(func(",
      "\tctx context.Context,",
      "\trc *collage.RenderContext,",
      ") (${1:nameView}, error) {",
      "\t$0",
      "\treturn ${1:nameView}{}, nil",
      "})",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cstate",
    description: "collage: a typed key for a value one fragment sets and another reads within a render — a data handler and a slot resolver",
    body: [
      "// Types what one fragment keeps for the others in the same render.",
      "type ${1:name}State struct {",
      "\t${2:Value string}",
      "}",
      "",
      "// Holds the ${1:name} state for the rest of a render: ${1:name}Key.Set(rc, state)",
      "// keeps it, ${1:name}Key.Get(rc) reads it, or its zero value and false.",
      "var ${1:name}Key = collage.NewKey[${1:name}State](\"${1:name}\")",
    ],
    imports: [COLLAGE_IMPORT],
  },

  // fragments/layouts/<name>.go
  {
    prefix: "clayout",
    description: "collage: a layout — a fragment whose template calls {{slot \"content\"}} (fragments/layouts)",
    body: [
      "// Returns the shell every page renders inside: templates/layouts/${1:default}.html.",
      "func ${2:Layout}() *collage.Fragment {",
      "\treturn collage.NewFragment(\"${3:layout}\", \"layouts/${1:default}.html\").",
      "\t\tWithTitle(\"${4:Site title}\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "clayoutg",
    description: "collage: a layout with a guard — every page inside it is guarded, its actions and fragment paths too",
    body: [
      "// Returns the ${1:name} layout; its guard decides who sees the pages inside it.",
      "func ${2:Name}(",
      "\t${3:service} ${4:*domain.Service},",
      ") *collage.Fragment {",
      "\treturn collage.NewFragment(\"${1:name}\", \"layouts/${1:name}.html\").",
      "\t\tWithGuard(guards.${5:Guard}(${3:service})).",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },

  // guards/
  {
    prefix: "cguard",
    description: "collage: a guard — nil lets the request through, a decision redirects or refuses it",
    body: [
      "// Lets the requests ${1:service} allows through and sends the rest to ${2:/path}.",
      "func ${3:Guard}(",
      "\t${1:service} ${4:*domain.Service},",
      ") collage.GuardFunc {",
      "\treturn func(",
      "\t\t_ context.Context,",
      "\t\tr *http.Request,",
      "\t) (*collage.GuardDecision, error) {",
      "\t\tif ${1:service}.${5:Allows}(r) {",
      "\t\t\treturn nil, nil",
      "\t\t}",
      "\t\treturn &collage.GuardDecision{Location: \"${2:/path}\"}, nil",
      "\t}",
      "}",
    ],
    imports: ["context", "net/http", COLLAGE_IMPORT],
  },

  // actions/<area>.go and actions/funcs/<area>.go
  {
    prefix: "cact",
    description: "collage: an action a page attaches with WithActionFor — no path of its own, the page's name (actions/<area>.go)",
    body: [
      "// Returns the ${1:name} action. Its page attaches it with WithActionFor.",
      "func ${2:Action}(",
      "\t${3:service} ${4:*domain.Service},",
      ") *collage.Action {",
      "\treturn collage.NewAction(\"${1:name}\").",
      "\t\tWithMethods(http.MethodPost).",
      "\t\tWithHandler(funcs.${2:Action}(${3:service})).",
      "\t\t$0Build()",
      "}",
    ],
    imports: ["net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cactp",
    description: "collage: an action at a URL of its own — register it in routes.go",
    body: [
      "// Returns the ${1:name} action, at ${2:/path}.",
      "func ${3:Action}(",
      "\t${4:service} ${5:*domain.Service},",
      ") *collage.Action {",
      "\treturn collage.NewAction(\"${1:name}\").",
      "\t\tWithPath(\"${6:en}\", \"${2:/path}\").",
      "\t\tWithMethods(http.MethodPost).",
      "\t\tWithHandler(funcs.${3:Action}(${4:service})).",
      "\t\tBuild()",
      "}",
    ],
    imports: ["net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cactf",
    description: "collage: a form's handler — validated with collage-validate, answered with a flash message and a redirect by name (actions/funcs/<area>.go)",
    body: [
      "// Validates the ${1:name} form, ${2:saves it} and redirects to the ${3:target} page.",
      "func ${4:Action}(",
      "\t${5:service} ${6:*domain.Service},",
      ") collage.ActionHandlerFunc {",
      "\treturn func(",
      "\t\tctx context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (*collage.ActionResult, error) {",
      "\t\tv := validate.Form(rc)",
      "\t\tv.Field(\"${7:field}\").Required().Message(\"${8:This field is required.}\")",
      "\t\tif !v.Valid() {",
      "\t\t\treturn validate.Refuse(rc, v, rc.Page), nil",
      "\t\t}",
      "\t\t$0",
      "\t\tflash.Add(rc, flash.Success, \"${9:Saved.}\")",
      "\t\ttarget, err := rc.URL(\"${3:target}\", nil)",
      "\t\tif err != nil {",
      "\t\t\treturn nil, err",
      "\t\t}",
      "\t\treturn collage.SeeOther(target), nil",
      "\t}",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT, VALIDATE, FLASH],
  },
  {
    prefix: "cactj",
    description: "collage: a handler answering with JSON, and dropping the cached pages that showed the old value",
    body: [
      "// Types the ${1:name} action's answer.",
      "type ${1:name}Response struct {",
      "\t${2:Value int64 `json:\"value\"`}",
      "}",
      "",
      "// Answers the ${1:name} action with ${3:its result}.",
      "func ${4:Action}() collage.ActionHandlerFunc {",
      "\treturn func(",
      "\t\tctx context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (*collage.ActionResult, error) {",
      "\t\tresult, err := collage.JSONOf(http.StatusOK, ${1:name}Response{$0})",
      "\t\tif err != nil {",
      "\t\t\treturn nil, err",
      "\t\t}",
      "\t\tresult.InvalidateTags = []string{\"${5:tag}\"}",
      "\t\treturn result, nil",
      "\t}",
      "}",
    ],
    imports: ["context", "net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cactr",
    description: "collage: a handler that answers with the page it was posted to, rendered again",
    body: [
      "// Answers the ${1:name} form with its own page, which reads what was posted.",
      "func ${2:Action}() collage.ActionHandlerFunc {",
      "\treturn func(",
      "\t\t_ context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (*collage.ActionResult, error) {",
      "\t\t$0",
      "\t\treturn collage.RenderPage(rc.Page), nil",
      "\t}",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },

  // Lines of a handler
  {
    prefix: "cval",
    description: "collage-validate: check the submitted form; a refusal answers with the page, the input and each field's message",
    body: [
      "v := validate.Form(rc)",
      "v.Field(\"${1:field}\").Required().Message(\"${2:This field is required.}\")",
      "if !v.Valid() {",
      "\treturn validate.Refuse(rc, v, rc.Page), nil",
      "}",
    ],
    imports: [VALIDATE],
  },
  {
    prefix: "cvf",
    description: "collage-validate: one field's rule, with its message",
    body: ["v.Field(\"${1:field}\").${2|Required(),Email(),MinLen(8),MaxLen(100)|}.Message(\"${3:message}\")"],
    imports: [],
  },
  {
    prefix: "cvfail",
    description: "collage-validate: refuse the form for a reason only the handler knows, such as a failed save",
    body: ["v.Fail(\"${1:form}\", \"${2:message}\")", "return validate.Refuse(rc, v, rc.Page), nil"],
    imports: [VALIDATE],
  },
  {
    prefix: "cvfields",
    description: "collage-validate: refuse with the messages a service gave by field",
    body: [
      "if err != nil {",
      "\tfor field, message := range ${1:domain}.FieldErrors(err) {",
      "\t\tv.Fail(field, message)",
      "\t}",
      "\treturn validate.Refuse(rc, v, rc.Page), nil",
      "}",
    ],
    imports: [VALIDATE],
  },
  {
    prefix: "cflash",
    description: "collage-flash: a message for the next page the reader sees",
    body: ["flash.Add(rc, flash.${1|Success,Info,Warning,Error|}, \"${2:message}\")"],
    imports: [FLASH],
  },
  {
    prefix: "credir",
    description: "collage: redirect to a page by name, in the request's locale",
    body: [
      "target, err := rc.URL(\"${1:name}\", ${2:nil})",
      "if err != nil {",
      "\treturn nil, err",
      "}",
      "return collage.SeeOther(target), nil",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "ccookie",
    description: "collage: redirect and set a cookie",
    body: [
      "return &collage.ActionResult{",
      "\tLocation: ${1:target},",
      "\tHeader: http.Header{",
      "\t\t\"Set-Cookie\": {${2:cookie}.String()},",
      "\t},",
      "}, nil",
    ],
    imports: ["net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cparam",
    description: "collage: a positive integer from a route parameter",
    body: [
      "// Reads the ${1:id} the path names, and whether it is one.",
      "func ${2:parseID}(rc *collage.RenderContext) (int64, bool) {",
      "\tid, err := strconv.ParseInt(rc.Param(\"${1:id}\"), 10, 64)",
      "\treturn id, err == nil && id > 0",
      "}",
    ],
    imports: ["strconv", COLLAGE_IMPORT],
  },
  {
    prefix: "cnotfound",
    description: "collage: a record that does not exist — a 404 when the fragment is Required",
    body: ["return ${1:nameView}{}, fmt.Errorf(\"${2:record} %d: %w\", ${3:id}, collage.ErrNotFound)"],
    imports: ["fmt", COLLAGE_IMPORT],
  },
  {
    prefix: "cmeta",
    description: "collage-meta: the page's title, description and canonical URL, with its Open Graph tags",
    body: [
      "rc.HoistTitle(\"${1:Title}\")",
      "meta.Set(rc, meta.Page{",
      "\tTitle:       \"${1:Title}\",",
      "\tDescription: \"${2:Description}\",",
      "\tCanonical:   ${3:canonical},",
      "})",
    ],
    imports: [META],
  },
  {
    prefix: "cjsonld",
    description: "collage-jsonld: a jsonld.Article's structured data",
    body: [
      "jsonld.Emit(rc, jsonld.Article{",
      "\tHeadline:      ${1:headline},",
      "\tDescription:   ${2:description},",
      "\tURL:           ${3:url},",
      "\tDatePublished: ${4:published},",
      "\tAuthorName:    ${5:author},",
      "})",
    ],
    imports: [JSONLD],
  },

  // documents/<name>.go
  {
    prefix: "cdoc",
    description: "collage: a document — a feed, a JSON file — rendered by a handler (documents/<name>.go)",
    body: [
      "// Returns the ${1:name} document, at ${2:/path}.",
      "func ${3:Name}() *collage.Document {",
      "\treturn collage.NewDocument(\"${1:name}\", \"${4:application/xml}\").",
      "\t\tWithPath(\"${5:en}\", \"${2:/path}\").",
      "\t\tWithHandler(${1:name}Body).",
      "\t\tBuild()",
      "}",
      "",
      "// Renders the ${1:name} document's body, and the tags of what it was made from.",
      "func ${1:name}Body(",
      "\tctx context.Context,",
      "\trc *collage.RenderContext,",
      ") ([]byte, []string, error) {",
      "\t$0",
      "\treturn ${6:body}, []string{\"${7:tag}\"}, nil",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cdocs",
    description: "collage: a document with a fixed body, at the site's root — a robots.txt, a humans.txt",
    body: [
      "// Returns ${1:/name.txt}.",
      "func ${2:Name}() *collage.Document {",
      "\treturn collage.NewDocument(\"${3:name}\", \"${4:text/plain; charset=utf-8}\").",
      "\t\tAtRoot(\"${1:/name.txt}\").",
      "\t\tWithBody([]byte(${5:\"\"})).",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },

  // data/<domain>/
  {
    prefix: "cservice",
    description: "data/<domain>: a domain's service, built once in main and handed to the pages and actions that need it",
    body: [
      "// ${1:Service} reads and writes ${2:the domain's records}.",
      "type ${1:Service} struct {",
      "\tdb *sql.DB",
      "}",
      "",
      "// Returns a ${1:Service} on db.",
      "func NewService(db *sql.DB) *${1:Service} {",
      "\treturn &${1:Service}{db: db}",
      "}",
    ],
    imports: ["database/sql"],
  },
  {
    prefix: "cerrs",
    description: "data/<domain>: the domain's errors, and the form field each one is shown beside",
    body: [
      "var (",
      "\t// ${1:ErrName} is returned when ${2:the condition holds}.",
      "\t${1:ErrName} = errors.New(\"${3:domain: what went wrong}\")",
      ")",
      "",
      "// Returns the form messages err stands for, by field.",
      "func FieldErrors(err error) map[string]string {",
      "\tswitch {",
      "\tcase errors.Is(err, ${1:ErrName}):",
      "\t\treturn map[string]string{\"${4:field}\": \"${5:message}\"}",
      "\tdefault:",
      "\t\treturn map[string]string{\"form\": \"${6:Something went wrong.}\"}",
      "\t}",
      "}",
    ],
    imports: ["errors"],
  },

  // routes.go
  {
    prefix: "creg",
    description: "collage: routes.go's register — every page, document and action in one app.Register call",
    body: [
      "// Registers every page, document and action to app.",
      "func register(",
      "\tapp *collage.App,",
      "\t${1:service} ${2:*domain.Service},",
      ") error {",
      "\tif err := app.Register(",
      "\t\t${3:pages.Name()},",
      "\t\t$0",
      "\t); err != nil {",
      "\t\treturn err",
      "\t}",
      "\tif err := app.RegisterNotFoundPage(errorpages.NotFoundPage()); err != nil {",
      "\t\treturn fmt.Errorf(\"register not-found page: %w\", err)",
      "\t}",
      "\treturn nil",
      "}",
    ],
    imports: ["fmt", COLLAGE_IMPORT],
  },

  // Caching
  {
    prefix: "ccached",
    description: "collage: a value shared across renders until its TTL passes or a tag is invalidated — under a collage.Key",
    body: [
      "${1:value}, err := collage.Cached(rc, ${2:name}Key, ${3:time.Minute}, []string{\"${4:tag}\"},",
      "\tfunc(ctx context.Context) (${5:Result}, error) { return ${6:fetch(ctx)} })",
    ],
    imports: ["context", "time", COLLAGE_IMPORT],
  },
  {
    prefix: "conce",
    description: "collage: a value fetched once per render, shared by the fragments that need it — under a collage.Key",
    body: [
      "${1:value}, err := collage.Once(rc, ${2:name}Key,",
      "\tfunc(ctx context.Context) (${3:Result}, error) { return ${4:fetch(ctx)} })",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cinval",
    description: "collage: drop the cached pages a change made stale — an action's answer carries the tags",
    body: ["result.InvalidateTags = []string{\"${1:tag}\"}"],
    imports: [],
  },

  // main.go
  {
    prefix: "cmw",
    description: "collage: middleware around every request, registered with app.Use",
    body: [
      "if err := app.Use(func(next http.Handler) http.Handler {",
      "\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {",
      "\t\t$0",
      "\t\tnext.ServeHTTP(w, r)",
      "\t})",
      "}); err != nil {",
      "\treturn nil, err",
      "}",
    ],
    imports: ["net/http"],
  },

  // *_test.go, with collagetest
  {
    prefix: "ctest",
    description: "collagetest: a page renders — the site main builds, driven like a browser",
    body: [
      "func Test${1:Name}(t *testing.T) {",
      "\tapp, err := newApp(false, 0)",
      "\tif err != nil {",
      "\t\tt.Fatal(err)",
      "\t}",
      "\tc := collagetest.New(t, app.Handler())",
      "",
      "\tres := c.Get(\"${2:/}\").WantStatus(http.StatusOK)",
      "\tif !strings.Contains(res.Body, \"${3:text}\") {",
      "\t\tt.Errorf(\"${2:/} does not contain %q:\\n%s\", \"${3:text}\", res.Body)",
      "\t}",
      "}",
    ],
    imports: ["net/http", "strings", "testing", COLLAGETEST],
  },
  {
    prefix: "ctestf",
    description: "collagetest: a form submitted with its forgery token and hidden fields, and where it redirects",
    body: [
      "func Test${1:Name}(t *testing.T) {",
      "\tapp, err := newApp(false, 0)",
      "\tif err != nil {",
      "\t\tt.Fatal(err)",
      "\t}",
      "\tc := collagetest.New(t, app.Handler())",
      "",
      "\tpage := c.Get(\"${2:/path}\").WantStatus(http.StatusOK)",
      "\tres := c.Submit(page, \"${2:/path}\", url.Values{",
      "\t\t\"${3:field}\": {\"${4:value}\"},",
      "\t}).WantStatus(http.StatusSeeOther)",
      "\tif res.Location() != \"${5:/next}\" {",
      "\t\tt.Errorf(\"Location = %q, want ${5:/next}\", res.Location())",
      "\t}",
      "\tc.Follow(res).WantStatus(http.StatusOK)",
      "}",
    ],
    imports: ["net/http", "net/url", "testing", COLLAGETEST],
  },

  // Plugins
  {
    prefix: "cplugin",
    description: "collage: a plugin skeleton — options read from the application's plugin configuration with collage.PluginConfig",
    body: [
      "// Name is the plugin's name, and the key its configuration is found under.",
      "const Name = \"${1:you}/${2:name}\"",
      "",
      "// Options configures the plugin.",
      "type Options struct {",
      "\t${3:Enabled bool `json:\"enabled\"`}",
      "}",
      "",
      "// Plugin ${4:does what}.",
      "type Plugin struct {",
      "\topts Options",
      "}",
      "",
      "// Returns a plugin with opts as its starting point, which the application's",
      "// own configuration is then decoded over.",
      "func New(opts Options) *Plugin { return &Plugin{opts: opts} }",
      "",
      "func (p *Plugin) Name() string                   { return Name }",
      "func (p *Plugin) Version() string                { return \"0.1.0\" }",
      "func (p *Plugin) Shutdown(context.Context) error { return nil }",
      "",
      "// Reads the configuration over the options New was given.",
      "func (p *Plugin) Init(_ context.Context, host collage.Host) error {",
      "\topts, err := collage.PluginConfig(host, p.opts)",
      "\tif err != nil {",
      "\t\treturn err",
      "\t}",
      "\tp.opts = opts",
      "\t$0",
      "\treturn nil",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "chook",
    description: "collage: a plugin's render hook — read, rewrite or check what a page rendered, or declare its defaults",
    body: [
      "// ${1:Checks what the page rendered}.",
      "func (p *Plugin) On${2|AfterRender,BeforeRender|}(ctx context.Context, ev *collage.${2}Event) error {",
      "\t$0",
      "\treturn nil",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
];
/** A text insertion at an offset of the document. */
export interface Insertion {
  offset: number;
  text: string;
}

/** blankComments replaces every comment with spaces, keeping newlines, so offsets
 * in the result are offsets in text. Strings are not skipped: before the first
 * declaration a file holds none. */
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, " "));
}

const packageClause = /^[ \t]*package[ \t]+([A-Za-z_]\w*)/m;

/** hasPackageClause reports whether text declares its package outside a comment. */
export function hasPackageClause(text: string): boolean {
  return packageClause.test(blankComments(text));
}

/** packageName is the package a new Go file in dir belongs to: what the files
 * beside it declare, main beside go.mod, otherwise the directory's name made an
 * identifier. */
export function packageName(opts: { dir: string; siblings: { file: string; text: string }[]; moduleRoot: boolean }): string {
  const ordered = [...opts.siblings].sort((a, b) => Number(a.file.endsWith("_test.go")) - Number(b.file.endsWith("_test.go")));
  for (const s of ordered) {
    const m = packageClause.exec(blankComments(s.text));
    if (m) return m[1].replace(/_test$/, "");
  }
  if (opts.moduleRoot) return "main";
  let name = path.basename(opts.dir).toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (name === "") name = "pkg";
  if (/^[0-9]/.test(name)) name = "p" + name;
  return name;
}

/** sortImports orders paths as goimports groups them: the standard library, whose
 * first element has no dot, before everything else. */
function sortImports(paths: string[]): string[] {
  const std = (p: string) => !p.split("/")[0].includes(".");
  return [...paths].sort((a, b) => Number(!std(a)) - Number(!std(b)) || a.localeCompare(b));
}

function importDecl(paths: string[]): string {
  if (paths.length === 1) return `import "${paths[0]}"`;
  return "import (\n" + paths.map((p) => `\t"${p}"\n`).join("") + ")";
}

/** headerEdits is what text needs above a snippet using imports: a package clause
 * named pkg when it has none, and whichever imports it lacks — added to a grouped
 * import block, after single-line imports, or after the package clause. An import
 * is present when its quoted path is in the file, aliased or not. */
export function headerEdits(text: string, pkg: string, imports: string[]): Insertion[] {
  const missing = sortImports([...new Set(imports)].filter((p) => !text.includes(`"${p}"`)));
  const code = blankComments(text);

  if (!packageClause.test(code)) {
    let header = `package ${pkg}\n\n`;
    if (missing.length > 0) header += importDecl(missing) + "\n\n";
    return [{ offset: 0, text: header }];
  }
  if (missing.length === 0) return [];

  const group = /^import[ \t]*\([ \t]*$/m.exec(code);
  if (group) {
    const close = /^\)[ \t]*$/m;
    close.lastIndex = 0;
    const after = code.slice(group.index);
    const end = close.exec(after);
    if (end) {
      return [{ offset: group.index + end.index, text: missing.map((p) => `\t"${p}"\n`).join("") }];
    }
  }

  const single = /^import[ \t]+(?:[A-Za-z_.]\w*[ \t]+)?"[^"\n]+"[ \t]*$/gm;
  let last: RegExpExecArray | null = null;
  for (let m = single.exec(code); m; m = single.exec(code)) last = m;
  if (last) {
    const lineEnd = last.index + last[0].length;
    return [{ offset: lineEnd, text: missing.map((p) => `\nimport "${p}"`).join("") }];
  }

  const clause = packageClause.exec(code)!;
  return [{ offset: clause.index + clause[0].length, text: "\n\n" + importDecl(missing) }];
}
