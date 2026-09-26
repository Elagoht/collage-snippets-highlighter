// Collage Snippets & Highlighter: completion and hover for collage templates.
//
// The snippets, the grammar and the plugins-config.json schema are declared in
// package.json and need no code. What is here is what needs to know where the
// cursor is: inside {{ … }}, collage's and its plugins' template functions; in a
// tag, collage-live's data-collage-* attributes.
import * as vscode from "vscode";
import catalogJSON from "../data/catalog.json";

interface TemplateFunction {
  name: string;
  source: string;
  signature: string;
  insert: string;
  doc: string;
  link?: string;
  repo?: string;
}

interface Attribute {
  name: string;
  value: string | null;
  doc: string;
  repo: string;
}

interface Catalog {
  functions: TemplateFunction[];
  builtins: { keywords: string[]; functions: string[] };
  attributes: Attribute[];
}

const catalog = catalogJSON as Catalog;
const byName = new Map(catalog.functions.map((f) => [f.name, f]));
const DOCS = "https://collage.furkanbaytekin.dev/en/docs/";

export function activate(context: vscode.ExtensionContext): void {
  const detector = new ProjectDetector();
  context.subscriptions.push(
    detector,
    vscode.languages.registerCompletionItemProvider("html", new Completion(detector), "{", " ", "(", "|", "-"),
    vscode.languages.registerHoverProvider("html", new Hover(detector)),
  );
}

export function deactivate(): void {}

// ProjectDetector answers whether completion belongs in a document: in a collage
// project — a go.mod requiring github.com/Elagoht/collage — unless the
// collage.completions setting says always or never.
class ProjectDetector implements vscode.Disposable {
  private cached: Promise<boolean> | undefined;
  private readonly watcher = vscode.workspace.createFileSystemWatcher("**/go.mod");

  constructor() {
    const reset = () => (this.cached = undefined);
    this.watcher.onDidChange(reset);
    this.watcher.onDidCreate(reset);
    this.watcher.onDidDelete(reset);
  }

  async enabled(): Promise<boolean> {
    const mode = vscode.workspace.getConfiguration("collage").get<string>("completions", "auto");
    if (mode === "always") return true;
    if (mode === "never") return false;
    this.cached ??= this.detect();
    return this.cached;
  }

  private async detect(): Promise<boolean> {
    const mods = await vscode.workspace.findFiles("**/go.mod", "**/{node_modules,vendor}/**", 20);
    for (const uri of mods) {
      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      if (/github\.com\/Elagoht\/collage\b/.test(text)) return true;
    }
    return false;
  }

  dispose(): void {
    this.watcher.dispose();
  }
}

// insideAction reports whether offset in text is inside a {{ … }} action.
function insideAction(text: string, offset: number): boolean {
  const open = text.lastIndexOf("{{", offset - 1);
  if (open < 0) return false;
  const close = text.lastIndexOf("}}", offset - 1);
  return close < open;
}

// insideTag reports whether offset is inside an opening tag, outside any action:
// where an attribute name goes.
function insideTag(text: string, offset: number): boolean {
  const lt = text.lastIndexOf("<", offset - 1);
  const gt = text.lastIndexOf(">", offset - 1);
  if (lt < 0 || gt > lt) return false;
  return /^<[a-zA-Z]/.test(text.slice(lt, lt + 2)) && !insideAction(text, offset);
}

function documentation(f: TemplateFunction): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(`{{${f.signature}}}`, "go");
  md.appendMarkdown(f.doc);
  const where = f.source === "collage" ? "collage" : `[${f.source}](https://github.com/Elagoht/${f.repo})`;
  const more = f.link ? ` · [docs](${DOCS}${f.link}/)` : "";
  md.appendMarkdown(`\n\n*${where}*${more}`);
  md.isTrusted = false;
  return md;
}

class Completion implements vscode.CompletionItemProvider {
  constructor(private readonly detector: ProjectDetector) {}

  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
    if (!(await this.detector.enabled())) return undefined;
    const text = doc.getText();
    const offset = doc.offsetAt(pos);

    if (insideAction(text, offset)) return this.functions(doc, pos);
    if (insideTag(text, offset)) return this.attributes(doc, pos);
    return undefined;
  }

  private functions(doc: vscode.TextDocument, pos: vscode.Position): vscode.CompletionItem[] {
    // After a dot is a field, not a function.
    const before = doc.lineAt(pos.line).text.slice(0, pos.character);
    if (/\.[A-Za-z_]*$/.test(before) || /\$[A-Za-z_]*$/.test(before)) return [];

    const items: vscode.CompletionItem[] = catalog.functions.map((f, i) => {
      const item = new vscode.CompletionItem({ label: f.name, detail: " " + f.signature.slice(f.name.length).trim(), description: f.source }, vscode.CompletionItemKind.Function);
      item.insertText = new vscode.SnippetString(f.insert);
      item.documentation = documentation(f);
      // collage's own first, then the plugins', then Go's.
      item.sortText = (f.source === "collage" ? "0" : "1") + String(i).padStart(3, "0");
      return item;
    });
    for (const k of catalog.builtins.keywords) {
      const item = new vscode.CompletionItem({ label: k, description: "Go template" }, vscode.CompletionItemKind.Keyword);
      item.sortText = "2" + k;
      items.push(item);
    }
    for (const fn of catalog.builtins.functions) {
      const item = new vscode.CompletionItem({ label: fn, description: "Go template" }, vscode.CompletionItemKind.Function);
      item.sortText = "3" + fn;
      items.push(item);
    }
    return items;
  }

  private attributes(doc: vscode.TextDocument, pos: vscode.Position): vscode.CompletionItem[] {
    const range = doc.getWordRangeAtPosition(pos, /[a-zA-Z-]+/);
    return catalog.attributes.map((a) => {
      const item = new vscode.CompletionItem({ label: a.name, description: a.repo }, vscode.CompletionItemKind.Property);
      item.insertText = new vscode.SnippetString(a.value === null ? a.name : `${a.name}="${a.value}"`);
      item.documentation = new vscode.MarkdownString(`${a.doc}\n\n*[${a.repo}](https://github.com/Elagoht/${a.repo})*`);
      if (range) item.range = range;
      return item;
    });
  }
}

class Hover implements vscode.HoverProvider {
  constructor(private readonly detector: ProjectDetector) {}

  async provideHover(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover | undefined> {
    if (!(await this.detector.enabled())) return undefined;
    const range = doc.getWordRangeAtPosition(pos, /[A-Za-z_][\w-]*/);
    if (!range) return undefined;
    const word = doc.getText(range);
    const text = doc.getText();
    const offset = doc.offsetAt(range.start);

    if (insideAction(text, offset)) {
      // A field that happens to share a function's name is not the function.
      if (offset > 0 && /[.$]/.test(text[offset - 1])) return undefined;
      const f = byName.get(word);
      return f ? new vscode.Hover(documentation(f), range) : undefined;
    }
    const attr = catalog.attributes.find((a) => a.name === word);
    if (attr) return new vscode.Hover(new vscode.MarkdownString(`${attr.doc}\n\n*[${attr.repo}](https://github.com/Elagoht/${attr.repo})*`), range);
    return undefined;
  }
}
