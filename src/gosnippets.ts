// The Go snippets that use an import — a whole function, or the lines of one —
// and what a file needs above one to compile: its package clause and its imports.
// Kept free of the vscode API so the rules can be tested in Node.
import * as path from "path";

export const COLLAGE_IMPORT = "github.com/Elagoht/collage/pkg/collage";
const VALIDATE = "github.com/Elagoht/collage-validate";
const FLASH = "github.com/Elagoht/collage-flash";
const META = "github.com/Elagoht/collage-meta";
const JSONLD = "github.com/Elagoht/collage-jsonld";

/** A snippet the extension offers in Go, with the imports its body uses. */
export interface FunctionSnippet {
  prefix: string;
  description: string;
  body: string[];
  imports: string[];
}

export const functionSnippets: FunctionSnippet[] = [
  {
    prefix: "cpagef",
    description: "collage: a function returning a page with a layout chain, like a scaffolded project's pages",
    body: [
      "func ${1:Home}Page() *collage.Page {",
      "\tcontent := collage.NewFragment(\"${2:home}\", \"pages/${2:home}.html\").Build()",
      "",
      "\treturn collage.NewPage(\"${2:home}\").",
      "\t\tWithLayouts(${3:layouts.Layout()}).",
      "\t\tWithContent(content).",
      "\t\tWithPath(\"${4:en}\", \"${5:/}\").",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cfragf",
    description: "collage: a function returning a fragment that renders a template file",
    body: [
      "func ${1:Card}() *collage.Fragment {",
      "\treturn collage.NewFragment(\"${2:card}\", \"${3:components/$2.html}\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cinlinef",
    description: "collage: a function returning a fragment whose template is written inline",
    body: [
      "func ${1:Row}() *collage.Fragment {",
      "\treturn collage.NewInlineFragment(\"${2:row}\", `",
      "\t\t${3:<p>{{.\\}\\}</p>}`).",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "clayoutf",
    description: "collage: a function returning a layout — a fragment whose template calls {{slot \"content\"}}",
    body: [
      "func ${1:Master}() *collage.Fragment {",
      "\treturn collage.NewFragment(\"${2:layout}\", \"layouts/${3:default}.html\").",
      "\t\tWithTitle(\"${4:My site}\").",
      "\t\t$0Build()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cguardf",
    description: "collage: a guard — nil lets the request through, a decision redirects or refuses it",
    body: [
      "func ${1:requireUser}(ctx context.Context, r *http.Request) (*collage.GuardDecision, error) {",
      "\tif ${2:allowed(ctx)} {",
      "\t\treturn nil, nil",
      "\t}",
      "\treturn &collage.GuardDecision{Status: http.StatusSeeOther, Location: \"${3:/login}\"}, nil",
      "}",
    ],
    imports: ["context", "net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cpagea",
    description: "collage: a function returning a page with layouts and the action its form posts to",
    body: [
      "func ${1:Login}Page(${2:service *users.UserService}) *collage.Page {",
      "\treturn collage.NewPage(\"${3:login}\").",
      "\t\tWithLayouts(${4:layouts.Master()}).",
      "\t\tWithContent(${5:fragments.LoginBlock()}).",
      "\t\tWithPath(\"${6:en}\", \"${7:/login}\").",
      "\t\tWithActionFor(${8:actions.Login(service)}).",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cactionf",
    description: "collage: a function returning a form's action — validated with collage-validate, answered with a flash message and a redirect by name",
    body: [
      "func ${1:Login}(${2:service *users.UserService}) *collage.Action {",
      "\treturn collage.NewAction(\"${3:login}\").",
      "\t\tWithMethods(http.MethodPost).",
      "\t\tWithHandler(func(ctx context.Context, rc *collage.RenderContext) (*collage.ActionResult, error) {",
      "\t\t\tv := validate.Form(rc)",
      "\t\t\tv.Field(\"${4:email}\").Required().Message(\"${5:This field is required.}\")",
      "\t\t\tif !v.Valid() {",
      "\t\t\t\treturn validate.Refuse(rc, v, rc.Page), nil",
      "\t\t\t}",
      "\t\t\t$0",
      "\t\t\tflash.Add(rc, flash.Success, \"${6:Saved.}\")",
      "\t\t\ttarget, err := rc.URL(\"${7:home}\", nil)",
      "\t\t\tif err != nil {",
      "\t\t\t\treturn nil, err",
      "\t\t\t}",
      "\t\t\treturn collage.SeeOther(target), nil",
      "\t\t}).",
      "\t\tBuild()",
      "}",
    ],
    imports: ["context", "net/http", COLLAGE_IMPORT, VALIDATE, FLASH],
  },
  {
    prefix: "cvalid",
    description: "collage-validate: check the submitted form, and answer a refusal with the page, the input and each field's message",
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
    prefix: "cflashadd",
    description: "collage-flash: a message for the next page the reader sees",
    body: ["flash.Add(rc, flash.${1|Success,Info,Warning,Error|}, \"${2:message}\")"],
    imports: [FLASH],
  },
  {
    prefix: "credirect",
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
    prefix: "cdataf",
    description: "collage: a data handler with its dependencies, loading a typed view",
    body: [
      "type ${1:home}View struct {",
      "\t${2:Title string}",
      "}",
      "",
      "func ${1:home}Data(${3:service *users.UserService}) collage.DataHandlerFunc {",
      "\treturn collage.Load(func(ctx context.Context, rc *collage.RenderContext) (${1:home}View, error) {",
      "\t\t$0",
      "\t\treturn ${1:home}View{}, nil",
      "\t})",
      "}",
    ],
    imports: ["context", COLLAGE_IMPORT],
  },
  {
    prefix: "cmeta",
    description: "collage-meta: the page's title, description and canonical URL, with its Open Graph tags",
    body: [
      "rc.HoistTitle(\"${1:Title}\")",
      "meta.Set(rc, meta.Page{",
      "\tTitle:       \"${1:Title}\",",
      "\tDescription: \"${2:Description}\",",
      "\tCanonical:   \"${3:/}\",",
      "})",
    ],
    imports: [META],
  },
  {
    prefix: "cjsonld",
    description: "collage-jsonld: an Article's structured data",
    body: [
      "jsonld.Emit(rc, jsonld.Article{",
      "\tHeadline:      ${1:post.Title},",
      "\tDescription:   ${2:post.Summary},",
      "\tURL:           ${3:url},",
      "\tDatePublished: ${4:post.CreatedAt},",
      "\tAuthorName:    ${5:post.Author},",
      "})",
    ],
    imports: [JSONLD],
  },
  {
    prefix: "cslotr",
    description: "collage: a slot resolver — which fragments fill a slot for this render; register it with WithSlotResolver",
    body: [
      "func resolve${1:Area}(rc *collage.RenderContext) ([]*collage.Fragment, error) {",
      "\tswitch {",
      "\tcase ${2:condition(rc)}:",
      "\t\treturn []*collage.Fragment{${3:first}}, nil",
      "\tdefault:",
      "\t\treturn []*collage.Fragment{${4:fallback}}, nil",
      "\t}",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cstate",
    description: "collage: a typed value one fragment sets and another reads within a render",
    body: [
      "const ${1:area}Key = \"${2:area}\"",
      "",
      "func set${3:Area}(rc *collage.RenderContext, state ${4:AreaState}) {",
      "\trc.Set(${1:area}Key, state)",
      "}",
      "",
      "func ${1:area}State(rc *collage.RenderContext) ${4:AreaState} {",
      "\tvalue, _ := rc.Get(${1:area}Key)",
      "\tstate, _ := value.(${4:AreaState})",
      "\treturn state",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cnotfound",
    description: "collage: a record that does not exist — a 404 when the fragment is Required",
    body: ["return ${1:view}{}, fmt.Errorf(\"${2:story} %q: %w\", ${3:id}, collage.ErrNotFound)"],
    imports: ["fmt", COLLAGE_IMPORT],
  },
  {
    prefix: "c404f",
    description: "collage: a not-found page, to register with RegisterPage and RegisterNotFoundPage",
    body: [
      "func NotFoundPage() *collage.Page {",
      "\treturn collage.NewPage(\"not-found\").",
      "\t\tWithLayouts(${1:layouts.Master()}).",
      "\t\tWithContent(collage.NewInlineFragment(\"not-found\", `",
      "\t\t\t${2:<p>Page not found.</p>}`).Build()).",
      "\t\tBuild()",
      "}",
    ],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "chtml",
    description: "collage: an inline template as a constant, coloured as HTML",
    body: ["const ${1:form} collage.InlineHTML = `", "$0", "`"],
    imports: [COLLAGE_IMPORT],
  },
  {
    prefix: "cregall",
    description: "collage: register a list of pages",
    body: [
      "for _, page := range []*collage.Page{",
      "\t${1:pages.Home()},",
      "} {",
      "\tif err := app.RegisterPage(page); err != nil {",
      "\t\treturn fmt.Errorf(\"register page %q: %w\", page.Name, err)",
      "\t}",
      "}",
    ],
    imports: ["fmt", COLLAGE_IMPORT],
  },
  {
    prefix: "ccookie",
    description: "collage: redirect and set a cookie",
    body: [
      "return &collage.ActionResult{",
      "\tLocation: ${1:target},",
      "\tHeader: http.Header{",
      "\t\t\"Set-Cookie\": []string{${2:cookie}.String()},",
      "\t},",
      "}, nil",
    ],
    imports: ["net/http", COLLAGE_IMPORT],
  },
  {
    prefix: "cparam",
    description: "collage: a positive integer from a route parameter",
    body: [
      "func ${1:storyID}(rc *collage.RenderContext) (int64, bool) {",
      "\tid, err := strconv.ParseInt(rc.Param(\"${2:id}\"), 10, 64)",
      "\treturn id, err == nil && id > 0",
      "}",
    ],
    imports: ["strconv", COLLAGE_IMPORT],
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
