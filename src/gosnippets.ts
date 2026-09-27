// The Go snippets that write a whole function — a page, a fragment, a layout, a
// guard — and what a file needs above one to compile: its package clause and its
// imports. Kept free of the vscode API so the rules can be tested in Node.
import * as path from "path";

export const COLLAGE_IMPORT = "github.com/Elagoht/collage/pkg/collage";

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
