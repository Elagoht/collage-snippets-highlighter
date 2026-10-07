// Collage Snippets & Highlighter.
//
// The snippets, the grammar and the static schemas are declared in package.json.
// What is here needs to know the project: completion and hover for template
// functions, names in their arguments (pages, fragments, slots, files) from what
// `go run . collage-inspect` reports, the plugins' collage.json manifests,
// diagnostics for names that do not exist, go-to-definition, and a
// plugins-config.json schema that includes every plugin the project depends on.
import * as vscode from "vscode";
import catalogJSON from "../data/catalog.json";
import staticSchemaJSON from "../schemas/plugins-config.schema.json";
import { Projects, type Project, type Manifest } from "./project";
import { allCalls, stringArgAt } from "./template";
import { namesFor, unknownName } from "./names";
import { functionSnippets, headerEdits, packageName } from "./gosnippets";
import { register as registerInlineHTML, VirtualDocuments } from "./inlinehtml";
import { completeAt, dataOf, fragmentsNamed, fragmentsOfTemplate, inComment, typeLabel, walk, type Value } from "./datatypes";
import { inlineTemplates, inlineUses } from "./embedded";
import { slotBindingAt, slotBindings, templateByName, templateSlots, type Parent } from "./goslots";
import * as fs from "fs";
import * as path from "path";

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
const DOCS = "https://collage.furkanbaytekin.dev/en/docs/";
const SCHEMA_URI = vscode.Uri.parse("collage-schema://collage/plugins-config.json");

export function activate(context: vscode.ExtensionContext): void {
  const projects = new Projects();
  const diagnostics = vscode.languages.createDiagnosticCollection("collage");
  const slotDiagnostics = vscode.languages.createDiagnosticCollection("collage-slots");
  const schema = new SchemaProvider(projects);
  const virtual = new VirtualDocuments();

  context.subscriptions.push(
    projects,
    diagnostics,
    slotDiagnostics,
    vscode.languages.registerCompletionItemProvider("html", new Completion(projects), '"', "{", " ", "(", "|", "-", "/", ".", "$"),
    vscode.languages.registerCompletionItemProvider("go", new SlotNames(projects, virtual), '"'),
    vscode.languages.registerCompletionItemProvider("go", new ManifestSnippets(projects, "go", virtual)),
    vscode.languages.registerCompletionItemProvider("go", new FunctionSnippets(projects, virtual)),
    vscode.languages.registerHoverProvider("html", new Hover(projects)),
    vscode.languages.registerDefinitionProvider("html", new Definition(projects)),
    vscode.workspace.registerTextDocumentContentProvider("collage-schema", schema),
    vscode.commands.registerCommand("collage.refresh", async () => {
      for (const p of await projects.all()) await p.refresh();
    }),
    vscode.commands.registerCommand("collage.showOutput", () => projects.log.show()),
    // For the integration tests: what the extension knows, as data.
    vscode.commands.registerCommand("collage._state", async () =>
      (await projects.all()).map((p) => ({ root: p.root, pages: p.inspection?.pages.map((x) => x.name), manifests: p.manifests.map((m) => m.name), error: p.error })),
    ),
  );

  registerInlineHTML(context, virtual);

  const check = new Diagnostics(projects, diagnostics, slotDiagnostics, virtual);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((d) => check.schedule(d)),
    vscode.workspace.onDidChangeTextDocument((e) => check.schedule(e.document)),
    vscode.workspace.onDidCloseTextDocument((d) => {
      diagnostics.delete(d.uri);
      slotDiagnostics.delete(d.uri);
    }),
    projects.onDidChange(() => {
      vscode.workspace.textDocuments.forEach((d) => check.schedule(d));
      schema.changed();
    }),
  );

  // Learn the projects, then what each is made of, in the background.
  void projects.all().then((ps) => ps.forEach((p) => void p.refresh()));
}

export function deactivate(): void {}

/** Whether a document gets completion and hover: in a collage project, unless the setting says otherwise. */
async function projectFor(projects: Projects, doc: vscode.TextDocument): Promise<{ enabled: boolean; project?: Project }> {
  const mode = vscode.workspace.getConfiguration("collage").get<string>("completions", "auto");
  if (mode === "never") return { enabled: false };
  const project = await projects.forFile(doc.fileName);
  return { enabled: mode === "always" || project !== undefined, project };
}

/** Every template function known for a project: the catalog's, then the manifests', then the application's own. */
function functionsFor(project: Project | undefined): TemplateFunction[] {
  const out = new Map<string, TemplateFunction>();
  for (const f of catalog.functions) out.set(f.name, f);
  for (const m of project?.manifests ?? []) {
    for (const f of m.templateFunctions ?? []) {
      // A manifest describes the release the project depends on: newer than the catalog.
      out.set(f.name, { name: f.name, source: m.name, signature: f.signature, insert: f.insert ?? f.name, doc: f.doc, repo: repoOf(m) });
    }
  }
  for (const name of project?.inspection?.templateFuncs ?? []) {
    if (!out.has(name) && !catalog.builtins.functions.includes(name)) {
      out.set(name, { name, source: "your application", signature: name, insert: name, doc: "A template function the application registers in Config.Template.Funcs, or a plugin without a collage.json." });
    }
  }
  return [...out.values()];
}

function attributesFor(project: Project | undefined): Attribute[] {
  const out = new Map<string, Attribute>();
  for (const a of catalog.attributes) out.set(a.name, a);
  for (const m of project?.manifests ?? []) for (const a of m.attributes ?? []) out.set(a.name, { ...a, repo: repoOf(m) ?? m.name });
  return [...out.values()];
}

function repoOf(m: Manifest): string | undefined {
  return m.repository?.replace(/^https:\/\/github\.com\/Elagoht\//, "");
}

function insideAction(text: string, offset: number): boolean {
  const open = text.lastIndexOf("{{", offset - 1);
  return open >= 0 && text.lastIndexOf("}}", offset - 1) < open;
}

function insideTag(text: string, offset: number): boolean {
  const lt = text.lastIndexOf("<", offset - 1);
  const gt = text.lastIndexOf(">", offset - 1);
  return lt >= 0 && gt < lt && /^<[a-zA-Z]/.test(text.slice(lt, lt + 2)) && !insideAction(text, offset);
}

function documentation(f: TemplateFunction): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(`{{${f.signature}}}`, "go");
  md.appendMarkdown(f.doc);
  const where = f.source === "collage" ? "collage" : f.repo ? `[${f.source}](https://github.com/Elagoht/${f.repo})` : f.source;
  md.appendMarkdown(`\n\n*${where}*${f.link ? ` · [docs](${DOCS}${f.link}/)` : ""}`);
  return md;
}

class Completion implements vscode.CompletionItemProvider {
  constructor(private readonly projects: Projects) {}

  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position, _token: vscode.CancellationToken, context?: vscode.CompletionContext): Promise<vscode.CompletionItem[] | undefined> {
    const { enabled, project } = await projectFor(this.projects, doc);
    if (!enabled) return undefined;
    const text = doc.getText();
    const offset = doc.offsetAt(pos);
    // "." and "$" are typed for the data in an action; anywhere else — a class
    // name in an attribute, a price in text — they ask for nothing.
    const trigger = context?.triggerCharacter;
    if ((trigger === "." || trigger === "$") && !insideAction(text, offset)) return undefined;
    if (insideAction(text, offset) && inComment(text, offset)) return undefined;

    // Inside a string argument: the names valid there.
    const arg = stringArgAt(text, offset);
    if (arg) {
      if (!project?.inspection) return undefined;
      const known = namesFor(project.inspection, project.templateName(doc.fileName), arg.call, arg.index);
      if (!known) return undefined;
      const range = new vscode.Range(doc.positionAt(arg.contentStart), doc.positionAt(arg.contentEnd));
      return known.names.map((n, i) => {
        const item = new vscode.CompletionItem({ label: n.label, description: n.detail }, vscode.CompletionItemKind.Value);
        item.range = range;
        item.sortText = String(i).padStart(5, "0");
        item.filterText = n.label;
        return item;
      });
    }
    if (insideAction(text, offset)) {
      const data = project?.inspection ? this.data(doc, text, offset, project) : undefined;
      return data ?? this.functions(doc, pos, project);
    }
    if (insideTag(text, offset)) return this.attributes(doc, pos, project);
    return undefined;
  }

  /** The fields and methods of the data after `.`, the variables after `$`. */
  private data(doc: vscode.TextDocument, text: string, offset: number, project: Project): vscode.CompletionItem[] | undefined {
    const types = project.inspection?.types ?? {};
    const section = templateSections(project, doc).find((s) => offset >= s.start && offset <= s.end);
    if (!section) return undefined;
    const found = completeAt(text, section.start, section.end, offset, section.data, types, { embedded: project.embedded });
    if (!found) return undefined;
    const range = new vscode.Range(doc.positionAt(found.start), doc.positionAt(found.end));
    if (found.kind === "variables") {
      return found.items.map((v) => {
        const item = new vscode.CompletionItem({ label: v.name, description: typeLabel(v.value) }, vscode.CompletionItemKind.Variable);
        item.range = range;
        item.sortText = v.name === "$" ? "1" : "0" + v.name;
        return item;
      });
    }
    return found.items.map((m) => {
      const method = m.args !== undefined;
      const only = m.on.length < m.of ? ` · only ${m.on.join(", ")}` : "";
      const item = new vscode.CompletionItem(
        { label: m.name, detail: method ? (m.args ? ` (${m.args} argument${m.args === 1 ? "" : "s"})` : " ()") : undefined, description: m.type + only },
        method ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Field,
      );
      item.range = range;
      item.sortText = (only ? "1" : "0") + (method ? "1" : "0") + m.name;
      item.documentation = new vscode.MarkdownString().appendCodeblock(method ? `func (${m.on.join(" | ")}) ${m.name}(${m.args ? "…" : ""}) ${m.type}` : `${m.name} ${m.type}`, "go");
      return item;
    });
  }

  private functions(doc: vscode.TextDocument, pos: vscode.Position, project: Project | undefined): vscode.CompletionItem[] {
    const before = doc.lineAt(pos.line).text.slice(0, pos.character);
    if (/[.$][\p{L}\p{N}_]*$/u.test(before)) return []; // a field or a variable, not a function
    const items = functionsFor(project).map((f, i) => {
      const item = new vscode.CompletionItem({ label: f.name, detail: " " + f.signature.slice(f.name.length).trim(), description: f.source }, vscode.CompletionItemKind.Function);
      item.insertText = new vscode.SnippetString(f.insert);
      item.documentation = documentation(f);
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

  private attributes(doc: vscode.TextDocument, pos: vscode.Position, project: Project | undefined): vscode.CompletionItem[] {
    const range = doc.getWordRangeAtPosition(pos, /[a-zA-Z-]+/);
    const items: vscode.CompletionItem[] = attributesFor(project).map((a) => {
      const item = new vscode.CompletionItem({ label: a.name, description: a.repo }, vscode.CompletionItemKind.Property);
      item.insertText = new vscode.SnippetString(a.value === null ? a.name : `${a.name}="${a.value}"`);
      item.documentation = new vscode.MarkdownString(`${a.doc}\n\n*${a.repo}*`);
      if (range) item.range = range;
      return item;
    });
    return items.concat(manifestSnippetItems(project, "html"));
  }
}

/** A template and its data: a template file whole, or one inline template of a Go file. */
interface Section {
  start: number;
  end: number;
  data: Value;
}

/** The templates in a document a fragment renders, each with the data it sees:
 * an HTML file under the template root, or the inline templates of the Go file a
 * virtual document stands for. */
function templateSections(project: Project, doc: vscode.TextDocument): Section[] {
  const inspection = project.inspection;
  if (!inspection) return [];
  const types = inspection.types ?? {};
  const goUri = VirtualDocuments.goUriOf(doc.uri);
  if (!goUri) {
    const fragments = fragmentsOfTemplate(inspection, project.templateName(doc.fileName));
    return fragments.length ? [{ start: 0, end: doc.getText().length, data: dataOf(fragments, types) }] : [];
  }
  const goDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === goUri.toString());
  if (!goDoc) return [];
  const go = goDoc.getText();
  let uses: Map<string, string[]> | undefined;
  const out: Section[] = [];
  for (const t of inlineTemplates(go)) {
    let names = t.fragment !== undefined ? [t.fragment] : [];
    if (t.ident) {
      uses ??= packageInlineUses(project, goDoc.fileName, go);
      names = uses.get(t.ident) ?? [];
    }
    const fragments = fragmentsNamed(inspection, names);
    if (fragments.length) out.push({ start: t.start, end: t.end, data: dataOf(fragments, types) });
  }
  return out;
}

/** Which fragments the InlineHTML constants of a Go file's package are passed to
 * NewInlineFragment with: in the file as it is now, and in the files beside it as
 * the last inspection read them. */
function packageInlineUses(project: Project, file: string, text: string): Map<string, string[]> {
  const out = inlineUses(text);
  const dir = path.dirname(file);
  for (const [other, uses] of project.inlineUses) {
    if (other === file || path.dirname(other) !== dir) continue;
    for (const [ident, fragments] of uses) out.set(ident, [...(out.get(ident) ?? []), ...fragments]);
  }
  return out;
}

/** The slots the template of the fragment a slot is bound on calls; undefined when it cannot be read. */
async function parentSlots(project: Project, parent: Parent | undefined): Promise<{ names: string[]; complete: boolean; template: string } | undefined> {
  if (!parent) return undefined;
  if (parent.inline !== undefined) return { ...templateSlots(parent.inline), template: `the inline template of ${parent.name ?? "the fragment"}` };
  const inspection = project.inspection;
  const template = parent.template ?? (parent.name !== undefined ? templateByName(inspection, parent.name) : undefined);
  if (!template) return undefined;
  const ext = inspection?.templateExtension ?? "";
  {
    for (const candidate of [template, template + ext]) {
      const file = path.join(project.templateDir, candidate);
      const open = vscode.workspace.textDocuments.find((d) => d.uri.scheme === "file" && d.fileName === file);
      let text: string | undefined = open?.getText();
      if (text === undefined) {
        try {
          text = await fs.promises.readFile(file, "utf8");
        } catch {
          continue;
        }
      }
      return { ...templateSlots(text), template };
    }
  }
  return undefined;
}

/** goChanged is whether a Go file of the project has unsaved changes the type table
 * may not reflect: anything but the text of its inline templates. */
async function goChanged(project: Project): Promise<boolean> {
  for (const d of vscode.workspace.textDocuments) {
    if (d.languageId !== "go" || d.uri.scheme !== "file" || !d.isDirty || !d.fileName.startsWith(project.root + path.sep)) continue;
    let saved: string;
    try {
      saved = await fs.promises.readFile(d.fileName, "utf8");
    } catch {
      return true;
    }
    if (outsideInline(d.getText()) !== outsideInline(saved)) return true;
  }
  return false;
}

/** outsideInline is Go text with its inline templates' text taken out. */
function outsideInline(go: string): string {
  let out = "";
  let at = 0;
  for (const r of inlineTemplates(go)) {
    out += go.slice(at, r.start);
    at = r.end;
  }
  return out + go.slice(at);
}

/** WithSlotFragment("…"): the slots the parent fragment's template calls. */
class SlotNames implements vscode.CompletionItemProvider {
  constructor(private readonly projects: Projects, private readonly virtual: VirtualDocuments) {}

  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
    if (this.virtual.regionAt(doc, pos)) return undefined; // HTML there, not Go
    const { enabled, project } = await projectFor(this.projects, doc);
    if (!enabled || !project) return undefined;
    const binding = slotBindingAt(doc.getText(), doc.offsetAt(pos));
    if (!binding) return undefined;
    const slots = await parentSlots(project, binding.parent);
    if (!slots) return undefined;
    const range = new vscode.Range(doc.positionAt(binding.start + 1), doc.positionAt(binding.closed ? binding.end - 1 : binding.end));
    return slots.names.map((name, i) => {
      const item = new vscode.CompletionItem({ label: name, description: `slot of ${slots.template}` }, vscode.CompletionItemKind.Value);
      item.range = range;
      item.sortText = String(i).padStart(4, "0");
      item.filterText = name;
      return item;
    });
  }
}

/** Snippets from manifests of plugins the extension's own snippets do not cover. */
function manifestSnippetItems(project: Project | undefined, language: "html" | "go"): vscode.CompletionItem[] {
  const out: vscode.CompletionItem[] = [];
  for (const m of project?.manifests ?? []) {
    if (repoOf(m) && catalog.functions.some((f) => f.repo === repoOf(m))) continue; // bundled already
    for (const [name, s] of Object.entries(m.snippets ?? {})) {
      if (s.language !== language) continue;
      const item = new vscode.CompletionItem({ label: s.prefix, description: m.name }, vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(s.body.join("\n"));
      item.documentation = new vscode.MarkdownString(s.description ?? name);
      out.push(item);
    }
  }
  return out;
}

class ManifestSnippets implements vscode.CompletionItemProvider {
  constructor(private readonly projects: Projects, private readonly language: "html" | "go", private readonly virtual: VirtualDocuments) {}
  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
    if (this.virtual.regionAt(doc, pos)) return undefined; // HTML there, not Go
    const { enabled, project } = await projectFor(this.projects, doc);
    return enabled ? manifestSnippetItems(project, this.language) : undefined;
  }
}

/** The snippets that write a whole function, offered with what the file needs
 * above them — its package clause when it has none, and the imports it lacks —
 * so the function compiles where it lands. */
class FunctionSnippets implements vscode.CompletionItemProvider {
  constructor(private readonly projects: Projects, private readonly virtual: VirtualDocuments) {}

  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
    if (this.virtual.regionAt(doc, pos)) return undefined; // HTML there, not Go
    const { enabled } = await projectFor(this.projects, doc);
    if (!enabled) return undefined;
    const text = doc.getText();
    const pkg = packageFor(doc);
    return functionSnippets.map((s) => {
      const item = new vscode.CompletionItem({ label: s.prefix, description: "collage" }, vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(s.body.join("\n"));
      item.documentation = new vscode.MarkdownString(s.description);
      item.additionalTextEdits = headerEdits(text, pkg, s.imports).map((e) => vscode.TextEdit.insert(doc.positionAt(e.offset), e.text));
      return item;
    });
  }
}

/** packageFor is the package a Go document belongs to, read from the files beside
 * it on disk; an unsaved document has none to read, and is main. */
function packageFor(doc: vscode.TextDocument): string {
  if (doc.isUntitled) return "main";
  const dir = path.dirname(doc.fileName);
  const siblings: { file: string; text: string }[] = [];
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".go") || path.join(dir, file) === doc.fileName) continue;
      siblings.push({ file, text: fs.readFileSync(path.join(dir, file), "utf8").slice(0, 4096) });
      if (siblings.length >= 8) break;
    }
  } catch {
    // An unreadable directory leaves the name to the directory's own.
  }
  return packageName({ dir, siblings, moduleRoot: fs.existsSync(path.join(dir, "go.mod")) });
}

class Hover implements vscode.HoverProvider {
  constructor(private readonly projects: Projects) {}

  async provideHover(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover | undefined> {
    const { enabled, project } = await projectFor(this.projects, doc);
    if (!enabled) return undefined;
    const range = doc.getWordRangeAtPosition(pos, /[\p{L}_][\p{L}\p{N}_-]*/u);
    if (!range) return undefined;
    const word = doc.getText(range);
    const text = doc.getText();
    const offset = doc.offsetAt(range.start);
    if (insideAction(text, offset)) {
      if (offset > 0 && /[.$"]/.test(text[offset - 1])) return undefined;
      const f = functionsFor(project).find((fn) => fn.name === word);
      return f ? new vscode.Hover(documentation(f), range) : undefined;
    }
    const attr = attributesFor(project).find((a) => a.name === word);
    return attr ? new vscode.Hover(new vscode.MarkdownString(`${attr.doc}\n\n*${attr.repo}*`), range) : undefined;
  }
}

/** From a name in a template to where the Go code declares it. */
class Definition implements vscode.DefinitionProvider {
  constructor(private readonly projects: Projects) {}

  async provideDefinition(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Location[] | undefined> {
    const project = await this.projects.forFile(doc.fileName);
    if (!project) return undefined;
    const arg = stringArgAt(doc.getText(), doc.offsetAt(pos));
    if (!arg) return undefined;
    const value = arg.call.args[arg.index].value;
    if (!value) return undefined;
    const q = JSON.stringify(value);
    let pattern: RegExp | undefined;
    const pageArg = { pageURL: 0, pageURLIn: 1, fragmentURL: 0, fragmentURLIn: 1 }[arg.call.name];
    if (pageArg === arg.index) pattern = new RegExp(`New(?:Page|Document)\\(\\s*${escape(q)}`);
    else if ((arg.call.name === "fragmentURL" && arg.index === 1) || (arg.call.name === "fragmentURLIn" && arg.index === 2)) pattern = new RegExp(`NewFragment\\(\\s*${escape(q)}`);
    else if (arg.call.name === "actionURL" && arg.index === 0) pattern = new RegExp(`NewAction\\(\\s*${escape(q)}`);
    else if (arg.call.name === "slot") pattern = new RegExp(`(?:WithSlotFragment|WithSlotResolver|WithSlot)\\(\\s*${escape(q)}`);
    else if (arg.call.name === "asset" || arg.call.name === "stylesheet") return this.file(project, value);
    if (!pattern) return undefined;

    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(project.root, "**/*.go"), "**/{vendor,node_modules}/**", 2000);
    const out: vscode.Location[] = [];
    for (const uri of files) {
      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      const m = pattern.exec(text);
      if (m) {
        const before = text.slice(0, m.index);
        const line = before.split("\n").length - 1;
        out.push(new vscode.Location(uri, new vscode.Position(line, m.index - before.lastIndexOf("\n") - 1)));
      }
    }
    return out;
  }

  /** A mounted file: the file of that name under the project, when there is one. */
  private async file(project: Project, urlPath: string): Promise<vscode.Location[] | undefined> {
    const mount = project.inspection?.mounts.find((m) => urlPath.startsWith(m.prefix));
    if (!mount) return undefined;
    const rel = urlPath.slice(mount.prefix.length);
    const found = await vscode.workspace.findFiles(new vscode.RelativePattern(project.root, `**/${rel}`), "**/{vendor,node_modules}/**", 5);
    return found.map((uri) => new vscode.Location(uri, new vscode.Position(0, 0)));
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names in templates that the application does not have — in an HTML file, and
 * in the inline HTML of a Go file, checked through its virtual document. */
class Diagnostics {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly projects: Projects,
    private readonly collection: vscode.DiagnosticCollection,
    private readonly slots: vscode.DiagnosticCollection,
    private readonly virtual: VirtualDocuments,
  ) {}

  schedule(doc: vscode.TextDocument): void {
    if (doc.languageId === "go" && doc.uri.scheme === "file") {
      // Its virtual document changes with it, and is checked when it does.
      const key = doc.uri.toString();
      clearTimeout(this.timers.get(key));
      this.timers.set(key, setTimeout(() => {
        if (this.virtual.regionsOf(doc).length > 0) void this.virtual.sync(doc);
        else this.collection.delete(doc.uri);
        void this.checkSlots(doc);
        // Unsaved Go code pauses the field warnings of every template.
        for (const html of vscode.workspace.textDocuments) if (html.languageId === "html" && html.uri.scheme === "file") this.schedule(html);
      }, 400));
      return;
    }
    if (doc.languageId !== "html") return;
    const key = doc.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => void this.check(doc), 400));
    // A template edited may now call the slot a Go file binds.
    if (doc.uri.scheme === "file") {
      clearTimeout(this.timers.get("slots"));
      this.timers.set("slots", setTimeout(() => {
        for (const go of vscode.workspace.textDocuments) if (go.languageId === "go" && go.uri.scheme === "file") void this.checkSlots(go);
      }, 800));
    }
  }

  private async check(doc: vscode.TextDocument): Promise<void> {
    const mode = vscode.workspace.getConfiguration("collage").get<string>("diagnostics", "warning");
    const project = await this.projects.forFile(doc.fileName);
    // A virtual document's findings are its Go file's: the offsets are the same.
    const target = VirtualDocuments.goUriOf(doc.uri) ?? doc.uri;
    if (mode === "off" || !project?.inspection) {
      this.collection.delete(target);
      return;
    }
    const text = doc.getText();
    const templateName = project.templateName(doc.fileName);
    const severity = mode === "error" ? vscode.DiagnosticSeverity.Error : mode === "information" ? vscode.DiagnosticSeverity.Information : vscode.DiagnosticSeverity.Warning;
    const out: vscode.Diagnostic[] = [];
    for (const call of allCalls(text)) {
      call.args.forEach((arg, index) => {
        const message = unknownName(project.inspection!, templateName, call, index);
        if (message) {
          const d = new vscode.Diagnostic(new vscode.Range(doc.positionAt(arg.start), doc.positionAt(arg.end)), message, severity);
          d.source = "collage";
          out.push(d);
        }
      });
    }
    // Names the data does not have: a warning at most, since the startup check
    // is the authority and this is early feedback.
    const dataSeverity = mode === "information" ? vscode.DiagnosticSeverity.Information : vscode.DiagnosticSeverity.Warning;
    const types = project.inspection.types ?? {};
    // While the application does not start, the type table is the one from before
    // whatever stopped it — likely the very change being made — so nothing is
    // said; nor while an inspection is under way or Go code is changed unsaved.
    const paused = project.error !== undefined || project.pending || (await goChanged(project));
    for (const section of paused ? [] : templateSections(project, doc)) {
      for (const f of walk(text, section.start, section.end, section.data, types, { embedded: project.embedded }).findings) {
        const d = new vscode.Diagnostic(new vscode.Range(doc.positionAt(f.start), doc.positionAt(f.end)), f.message, dataSeverity);
        d.source = "collage";
        out.push(d);
      }
    }
    this.collection.set(target, out);
  }

  /** WithSlotFragment and WithSlotResolver binding into a slot the parent's template never calls. */
  private async checkSlots(doc: vscode.TextDocument): Promise<void> {
    const mode = vscode.workspace.getConfiguration("collage").get<string>("diagnostics", "warning");
    const project = await this.projects.forFile(doc.fileName);
    if (mode === "off" || !project?.inspection) {
      this.slots.delete(doc.uri);
      return;
    }
    const severity = mode === "information" ? vscode.DiagnosticSeverity.Information : vscode.DiagnosticSeverity.Warning;
    const version = doc.version;
    const out: vscode.Diagnostic[] = [];
    for (const b of slotBindings(doc.getText())) {
      if (b.method === "WithSlot" || !b.closed || b.value === "") continue;
      const slots = await parentSlots(project, b.parent);
      if (!slots?.complete || slots.names.includes(b.value)) continue;
      const calls = slots.names.length ? `it calls ${slots.names.map((n) => JSON.stringify(n)).join(", ")}` : "it calls none";
      const d = new vscode.Diagnostic(new vscode.Range(doc.positionAt(b.start), doc.positionAt(b.end)), `${slots.template} never calls {{slot ${JSON.stringify(b.value)}}}; ${calls}.`, severity);
      d.source = "collage";
      out.push(d);
    }
    if (doc.version === version) this.slots.set(doc.uri, out);
  }
}

/** plugins-config.json's schema: the published plugins', and every manifest's in the workspace. */
class SchemaProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;

  constructor(private readonly projects: Projects) {}

  changed(): void {
    this.emitter.fire(SCHEMA_URI);
  }

  async provideTextDocumentContent(): Promise<string> {
    const schema = JSON.parse(JSON.stringify(staticSchemaJSON)) as { properties: Record<string, unknown> };
    for (const p of await this.projects.all()) {
      for (const m of p.manifests) {
        // A published plugin's schema is generated from its latest source and
        // bundled; a manifest adds what the bundle does not know — your plugins,
        // a third party's.
        if (m.config && !(m.name in schema.properties)) schema.properties[m.name] = { description: m.description, ...m.config };
      }
    }
    return JSON.stringify(schema);
  }
}

