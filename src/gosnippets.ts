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
export const functionSnippets: FunctionSnippet[] = [
  // pages/<area>/<name>.go
  {
    prefix: "cpage",
    description: "collage: a page — its layout, content and path (pages/<area>/<name>.go)",
    body: [
      "// Returns the ${1:home} page: its layout, content and path.",
      "func ${2:Home}() *collage.Page {",
      "\treturn collage.NewPage(\"${1:home}\").",
      "\t\tWithLayouts(${3:layouts.Master()}).",
      "\t\tWithContent(fragments.${2:Home}()).",
      "\t\tWithPath(\"${4:en}\", \"${5:/}\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cpagea",
    description: "collage: a page with the action its form posts to, attached at its URL",
    body: [
      "// Returns the ${1:login} page, with the action its form posts to.",
      "func ${2:Login}(",
      "\t${3:userService *users.UserService},",
      ") *collage.Page {",
      "\treturn collage.NewPage(\"${1:login}\").",
      "\t\tWithLayouts(${4:layouts.Master()}).",
      "\t\tWithContent(fragments.${2:Login}()).",
      "\t\tWithPath(\"${5:en}\", \"${6:/login}\").",
      "\t\tWithActionFor(actions.${2:Login}(${7:userService})).",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cpagep",
    description: "collage: a page at a path with a parameter, its content Required so a missing record is a 404",
    body: [
      "// Returns the ${1:story} page, one per ${2:id}.",
      "func ${3:Detail}(",
      "\t${4:storyService *stories.StoryService},",
      ") *collage.Page {",
      "\treturn collage.NewPage(\"${1:story}\").",
      "\t\tWithLayouts(${5:layouts.Master()}).",
      "\t\tWithContent(fragments.${3:Detail}(${6:storyService})).",
      "\t\tWithPath(\"${7:en}\", \"${8:/stories}/{${2:id}}\").",
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
      "\t\tWithLayouts(${1:layouts.Master()}).",
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
      "type ${1:home}View struct {",
      "\t${2:Title string}",
      "}",
      "",
      "// Returns the ${1:home} page's content.",
      "func ${3:Home}() *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${1:home}\", ${1:home}Block).",
      "\t\tWithDataHandler(collage.Load(${1:home}Data)).",
      "\t\tBuild()",
      "}",
      "",
      "const ${1:home}Block collage.InlineHTML = `<main>",
      "  ${4:<h1>{{.Title\\}\\}</h1>}",
      "</main>`",
      "",
      "// Reads what this page renders.",
      "func ${1:home}Data(",
      "\t_ context.Context,",
      "\trc *collage.RenderContext,",
      ") (${1:home}View, error) {",
      "\trc.HoistTitle(\"${5:Home}\")",
      "\t$0",
      "\treturn ${1:home}View{${6:Title: \"${5:Home}\"}}, nil",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cfragf",
    description: "collage: a fragment whose template is a file under the template root",
    body: [
      "// Returns the ${1:card} fragment, templates/${2:components/$1}.html.",
      "func ${3:Card}() *collage.Fragment {",
      "\treturn collage.NewFragment(\"${1:card}\", \"${2:components/$1}.html\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cfragd",
    description: "collage: a fragment whose data handler needs a service — the handler is a factory taking it",
    body: [
      "// Returns the ${1:detail} content, read through ${2:storyService}.",
      "func ${3:Detail}(",
      "\t${2:storyService} ${4:*stories.StoryService},",
      ") *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${1:detail}\", ${1:detail}Block).",
      "\t\tWithDataHandler(${1:detail}Data(${2:storyService})).",
      "\t\tRequired().",
      "\t\tBuild()",
      "}",
      "",
      "const ${1:detail}Block collage.InlineHTML = `${5:<h1>{{.Title\\}\\}</h1>}`",
      "",
      "// Types data used on this page.",
      "type ${1:detail}View struct {",
      "\t${6:Title string}",
      "}",
      "",
      "// Reads the record the path names; a missing one is a 404.",
      "func ${1:detail}Data(",
      "\t${2:storyService} ${4:*stories.StoryService},",
      ") collage.DataHandlerFunc {",
      "\treturn collage.Load(func(",
      "\t\tctx context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (${1:detail}View, error) {",
      "\t\t$0",
      "\t\treturn ${1:detail}View{}, nil",
      "\t})",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cfrags",
    description: "collage: a fragment whose slot is filled per render, with the resolver that picks what goes in it",
    body: [
      "// Returns the ${1:detail} content, with its ${2:entry-area} slot chosen per render.",
      "func ${3:Detail}() *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${1:detail}\", `{{slot \"${2:entry-area}\"\\}\\}`).",
      "\t\tWithSlotResolver(\"${2:entry-area}\", resolve${4:EntryArea}).",
      "\t\tBuild()",
      "}",
      "",
      "// Picks the fragments that fill the ${2:entry-area} slot for this render.",
      "func resolve${4:EntryArea}(",
      "\trc *collage.RenderContext,",
      ") ([]*collage.Fragment, error) {",
      "\tif ${5:canWrite(rc)} {",
      "\t\treturn []*collage.Fragment{${6:entryAdd}}, nil",
      "\t}",
      "\treturn []*collage.Fragment{${7:entryClosed}}, nil",
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
    body: ["const ${1:form}Block collage.InlineHTML = `", "$0", "`"],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cload",
    description: "collage: a typed data handler, with collage.Load",
    body: [
      "collage.Load(func(",
      "\tctx context.Context,",
      "\trc *collage.RenderContext,",
      ") (${1:homeView}, error) {",
      "\t$0",
      "\treturn ${1:homeView}{}, nil",
      "})",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cstate",
    description: "collage: a typed value one fragment sets and another reads within a render — a data handler and a slot resolver",
    body: [
      "const ${1:entryArea}Key = \"${2:entry-area}\"",
      "",
      "// Keeps state for the rest of this render.",
      "func set${3:EntryArea}(",
      "\trc *collage.RenderContext,",
      "\tstate ${4:entryAreaState},",
      ") {",
      "\trc.Set(${1:entryArea}Key, state)",
      "}",
      "",
      "// Reads the state set${3:EntryArea} kept, or its zero value.",
      "func ${1:entryArea}(rc *collage.RenderContext) ${4:entryAreaState} {",
      "\tstate, _ := collage.Get[${4:entryAreaState}](rc, ${1:entryArea}Key)",
      "\treturn state",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },

  // fragments/layouts/<name>.go
  {
    prefix: "clayout",
    description: "collage: a layout — a fragment whose template calls {{slot \"content\"}} (fragments/layouts)",
    body: [
      "// Returns the shell every page renders inside: templates/layouts/${1:default}.html.",
      "func ${2:Master}() *collage.Fragment {",
      "\treturn collage.NewFragment(\"${3:layout}\", \"layouts/${1:default}.html\").",
      "\t\tWithTitle(\"${4:My site}\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "clayoutg",
    description: "collage: a layout with a guard — every page inside it is guarded, its actions and fragment paths too",
    body: [
      "// Returns the ${1:panel}'s layout, open only to ${2:signed-in readers}.",
      "func ${3:Panel}(",
      "\t${4:userService *users.UserService},",
      ") *collage.Fragment {",
      "\treturn collage.NewFragment(\"${1:panel}\", \"layouts/${1:panel}.html\").",
      "\t\tWithGuard(guards.${5:RequireUser}(${6:userService})).",
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
      "// Lets ${1:signed-in readers} through and sends everyone else to ${2:/login}.",
      "func ${3:RequireUser}(",
      "\t${4:service *users.UserService},",
      ") collage.GuardFunc {",
      "\treturn func(",
      "\t\t_ context.Context,",
      "\t\tr *http.Request,",
      "\t) (*collage.GuardDecision, error) {",
      "\t\tif ${5:service.SignedIn(r)} {",
      "\t\t\treturn nil, nil",
      "\t\t}",
      "\t\treturn &collage.GuardDecision{Location: \"${2:/login}\"}, nil",
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
      "// Returns the ${1:login} action. Its page attaches it with WithActionFor.",
      "func ${2:Login}(",
      "\t${3:userService *users.UserService},",
      ") *collage.Action {",
      "\treturn collage.NewAction(\"${1:login}\").",
      "\t\tWithMethods(http.MethodPost).",
      "\t\tWithHandler(funcs.${2:Login}(${4:userService})).",
      "\t\t$0Build()",
      "}",
    ],
    imports: ["net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cactp",
    description: "collage: an action at a URL of its own — register it in routes.go",
    body: [
      "// Returns the ${1:logout} action, at ${2:/logout}.",
      "func ${3:Logout}(",
      "\t${4:userService *users.UserService},",
      ") *collage.Action {",
      "\treturn collage.NewAction(\"${1:logout}\").",
      "\t\tWithPath(\"${5:en}\", \"${2:/logout}\").",
      "\t\tWithMethods(http.MethodPost).",
      "\t\tWithHandler(funcs.${3:Logout}(${6:userService})).",
      "\t\tBuild()",
      "}",
    ],
    imports: ["net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cactf",
    description: "collage: a form's handler — validated with collage-validate, answered with a flash message and a redirect by name (actions/funcs/<area>.go)",
    body: [
      "// Validates the ${1:story} form, ${2:saves it} and redirects to ${3:stories}.",
      "func ${4:StoryCreate}(",
      "\t${5:storyService *stories.StoryService},",
      ") collage.ActionHandlerFunc {",
      "\treturn func(",
      "\t\tctx context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (*collage.ActionResult, error) {",
      "\t\tv := validate.Form(rc)",
      "\t\tv.Field(\"${6:title}\").Required().Message(\"${7:This field is required.}\")",
      "\t\tif !v.Valid() {",
      "\t\t\treturn validate.Refuse(rc, v, rc.Page), nil",
      "\t\t}",
      "\t\t$0",
      "\t\tflash.Add(rc, flash.Success, \"${8:Saved.}\")",
      "\t\ttarget, err := rc.URL(\"${3:stories}\", nil)",
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
      "// Types the ${1:count} action's answer.",
      "type ${1:count}Response struct {",
      "\t${2:Count int64 `json:\"count\"`}",
      "}",
      "",
      "// Answers the ${1:count} action with ${3:the new count}.",
      "func ${4:Count}() collage.ActionHandlerFunc {",
      "\treturn func(",
      "\t\tctx context.Context,",
      "\t\trc *collage.RenderContext,",
      "\t) (*collage.ActionResult, error) {",
      "\t\tresult, err := collage.JSONOf(http.StatusOK, ${1:count}Response{$0})",
      "\t\tif err != nil {",
      "\t\t\treturn nil, err",
      "\t\t}",
      "\t\tresult.InvalidateTags = []string{\"${5:count}\"}",
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
      "// Answers the ${1:hello} form with its own page, which reads what was posted.",
      "func ${2:Hello}() collage.ActionHandlerFunc {",
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
      "v.Field(\"${1:email}\").Required().Message(\"${2:This field is required.}\")",
      "if !v.Valid() {",
      "\treturn validate.Refuse(rc, v, rc.Page), nil",
      "}",
    ],
    imports: [VALIDATE],
  },
  {
    prefix: "cvf",
    description: "collage-validate: one field's rule, with its message",
    body: ["v.Field(\"${1:name}\").${2|Required(),Email(),MinLen(8),MaxLen(100)|}.Message(\"${3:message}\")"],
    imports: [],
  },
  {
    prefix: "cvfail",
    description: "collage-validate: refuse the form for a reason only the handler knows — a taken e-mail, a failed save",
    body: ["v.Fail(\"${1:form}\", \"${2:message}\")", "return validate.Refuse(rc, v, rc.Page), nil"],
    imports: [VALIDATE],
  },
  {
    prefix: "cvfields",
    description: "collage-validate: refuse with the messages a service gave by field",
    body: [
      "if err != nil {",
      "\tfor field, message := range ${1:stories}.FieldErrors(err) {",
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
      "target, err := rc.URL(\"${1:home}\", ${2:nil})",
      "if err != nil {",
      "\treturn nil, err",
      "}",
      "return collage.SeeOther(target), nil",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "ccookie",
    description: "collage: redirect and set a cookie — a sign-in, a sign-out",
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
      "func ${2:storyID}(rc *collage.RenderContext) (int64, bool) {",
      "\tid, err := strconv.ParseInt(rc.Param(\"${1:id}\"), 10, 64)",
      "\treturn id, err == nil && id > 0",
      "}",
    ],
    imports: ["strconv", COLLAGE_IMPORT],
  },
  {
    prefix: "cnotfound",
    description: "collage: a record that does not exist — a 404 when the fragment is Required",
    body: ["return ${1:detailView}{}, fmt.Errorf(\"${2:story} %d: %w\", ${3:id}, collage.ErrNotFound)"],
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
    description: "collage-jsonld: an Article's structured data",
    body: [
      "jsonld.Emit(rc, jsonld.Article{",
      "\tHeadline:      ${1:story.Title},",
      "\tDescription:   ${2:story.Summary},",
      "\tURL:           ${3:url},",
      "\tDatePublished: ${4:story.CreatedAt},",
      "\tAuthorName:    ${5:story.Author},",
      "})",
    ],
    imports: [JSONLD],
  },

  // documents/<name>.go
  {
    prefix: "cdoc",
    description: "collage: a document — a feed, a JSON file — rendered by a handler (documents/<name>.go)",
    body: [
      "// Returns the ${1:feed} document, at ${2:/feed.xml}.",
      "func ${3:Feed}() *collage.Document {",
      "\treturn collage.NewDocument(\"${1:feed}\", \"${4:application/xml}\").",
      "\t\tWithPath(\"${5:en}\", \"${2:/feed.xml}\").",
      "\t\tWithHandler(${1:feed}Body).",
      "\t\tBuild()",
      "}",
      "",
      "// Renders the ${1:feed} document's body, and the tags of what it was made from.",
      "func ${1:feed}Body(",
      "\tctx context.Context,",
      "\trc *collage.RenderContext,",
      ") ([]byte, []string, error) {",
      "\t$0",
      "\treturn ${6:body}, []string{\"${7:stories}\"}, nil",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cdocs",
    description: "collage: a document with a fixed body, at the site's root — a robots.txt, a humans.txt",
    body: [
      "// Returns ${1:/humans.txt}.",
      "func ${2:Humans}() *collage.Document {",
      "\treturn collage.NewDocument(\"${3:humans}\", \"${4:text/plain; charset=utf-8}\").",
      "\t\tAtRoot(\"${1:/humans.txt}\").",
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
      "// ${1:StoryService} reads and writes ${2:stories}.",
      "type ${1:StoryService} struct {",
      "\tdb *sql.DB",
      "}",
      "",
      "// Returns a ${1:StoryService} on db.",
      "func NewService(db *sql.DB) *${1:StoryService} {",
      "\treturn &${1:StoryService}{db: db}",
      "}",
    ],
    imports: ["database/sql"],
  },
  {
    prefix: "cerrs",
    description: "data/<domain>: the domain's errors, and the form field each one is shown beside",
    body: [
      "var (",
      "\t// ${1:ErrTitleTaken} is returned when ${2:a story with that title exists}.",
      "\t${1:ErrTitleTaken} = errors.New(\"${3:stories: title taken}\")",
      ")",
      "",
      "// Returns the form messages err stands for, by field.",
      "func FieldErrors(err error) map[string]string {",
      "\tswitch {",
      "\tcase errors.Is(err, ${1:ErrTitleTaken}):",
      "\t\treturn map[string]string{\"${4:title}\": \"${5:That title is taken.}\"}",
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
      "\t${1:userService *users.UserService},",
      ") error {",
      "\tif err := app.Register(",
      "\t\t${2:landingpages.Home()},",
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
    description: "collage: a value shared across renders until its TTL passes or a tag is invalidated",
    body: [
      "${1:stories}, err := collage.Cached(rc, \"${2:stories:latest}\", ${3:time.Minute}, []string{\"${4:stories}\"},",
      "\tfunc(ctx context.Context) (${5:[]Story}, error) { return ${6:storyService.Latest(ctx)} })",
    ],
    imports: ["context", "time", COLLAGE_IMPORT],
  },
  {
    prefix: "conce",
    description: "collage: a value fetched once per render, shared by the fragments that need it",
    body: [
      "${1:user}, err := collage.Once(rc, \"${2:user}\",",
      "\tfunc(ctx context.Context) (${3:*users.User}, error) { return ${4:userService.CurrentUser(rc.Request)} })",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cinval",
    description: "collage: drop the cached pages a change made stale — an action's answer carries the tags",
    body: ["result.InvalidateTags = []string{\"${1:stories}\"}"],
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
      "func Test${1:Home}(t *testing.T) {",
      "\tapp, err := newApp(false, 0)",
      "\tif err != nil {",
      "\t\tt.Fatal(err)",
      "\t}",
      "\tc := collagetest.New(t, app.Handler())",
      "",
      "\tres := c.Get(\"${2:/}\").WantStatus(http.StatusOK)",
      "\tif !strings.Contains(res.Body, \"${3:Welcome}\") {",
      "\t\tt.Errorf(\"${2:/} does not contain %q:\\n%s\", \"${3:Welcome}\", res.Body)",
      "\t}",
      "}",
    ],
    imports: ["net/http", "strings", "testing", COLLAGETEST],
  },
  {
    prefix: "ctestf",
    description: "collagetest: a form submitted with its forgery token and hidden fields, and where it redirects",
    body: [
      "func Test${1:Login}(t *testing.T) {",
      "\tapp, err := newApp(false, 0)",
      "\tif err != nil {",
      "\t\tt.Fatal(err)",
      "\t}",
      "\tc := collagetest.New(t, app.Handler())",
      "",
      "\tpage := c.Get(\"${2:/login}\").WantStatus(http.StatusOK)",
      "\tres := c.Submit(page, \"${2:/login}\", url.Values{",
      "\t\t\"${3:email}\": {\"${4:ada@example.com}\"},",
      "\t}).WantStatus(http.StatusSeeOther)",
      "\tif res.Location() != \"${5:/panel}\" {",
      "\t\tt.Errorf(\"Location = %q, want ${5:/panel}\", res.Location())",
      "\t}",
      "\tc.Follow(res).WantStatus(http.StatusOK)",
      "}",
    ],
    imports: ["net/http", "net/url", "testing", COLLAGETEST],
  },

  // Plugins
  {
    prefix: "cplugin",
    description: "collage: a plugin skeleton — options read from the application's plugin configuration",
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
      "// Reads the configuration.",
      "func (p *Plugin) Init(_ context.Context, host collage.Host) error {",
      "\tif err := host.Config(&p.opts); err != nil {",
      "\t\treturn err",
      "\t}",
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
