// What the extension knows about the collage project a document belongs to: what
// `go run . collage-inspect` says the application is made of, and what the
// collage.json of every module it depends on says about itself.
import * as vscode from "vscode";
import * as cp from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { embeddedFields } from "./datatypes";

export interface Inspection {
  version: number;
  templateRoot: string;
  templateExtension: string;
  defaultLocale: string;
  locales: string[];
  pages: { name: string; paths: Record<string, string>; params?: string[]; layout?: string; content?: string; fragmentPaths?: { fragment: string; locale: string; pattern: string; params?: string[] }[] }[];
  fragments: InspectedFragment[];
  documents: { name: string; paths: Record<string, string>; params?: string[]; contentType: string }[];
  actions: { name: string; paths: Record<string, string>; methods: string[] }[];
  templateFuncs: string[];
  plugins: { name: string; version: string }[];
  mounts: { prefix: string; files: string[] }[];
  /** The named types the fragments' data reaches, by Go name (collage v0.49.0). */
  types?: Record<string, InspectedType>;
}

export interface InspectedFragment {
  name: string;
  /** The template's path under the template root; empty for an inline fragment. */
  template: string;
  slots?: string[];
  inline?: boolean;
  /** The Go type the template sees as dot: "blog.Post", "nil" for no data, null when unknown (collage v0.49.0). */
  dataType?: string | null;
  /** false when the fragment was built WithoutTypeCheck. */
  typeCheck?: boolean;
}

/** The shape of a named type: its exported fields and the methods of it and its pointer. */
export interface InspectedType {
  kind: string;
  fields?: { name: string; type: string }[];
  methods?: { name: string; args: number; returns: string }[];
}

export interface Manifest {
  name: string;
  description?: string;
  repository?: string;
  templateFunctions?: { name: string; signature: string; insert?: string; doc: string }[];
  attributes?: { name: string; value: string | null; doc: string }[];
  snippets?: Record<string, { language: "html" | "go"; prefix: string; body: string[]; description?: string }>;
  config?: Record<string, unknown>;
}

/** One module requiring collage: the directory its go.mod is in, and what is known of it. */
export class Project {
  inspection: Inspection | undefined;
  manifests: Manifest[] = [];
  /** The names Go source in the project embeds in a struct: never reported as
   * missing from a template's data, since the type table does not list them. */
  embedded: Set<string> = new Set();
  error: string | undefined;
  private running: Promise<void> | undefined;

  constructor(readonly root: string, private readonly log: vscode.OutputChannel, private readonly onChange: () => void) {}

  /** Refreshes the inspection and the manifests, one refresh at a time. */
  refresh(): Promise<void> {
    this.running ??= this.load().finally(() => {
      this.running = undefined;
      this.onChange();
    });
    return this.running;
  }

  private async load(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("collage");
    const go = cfg.get<string>("goCommand", "go");
    const [manifests, inspection] = await Promise.all([
      this.readManifests(go),
      cfg.get<boolean>("inspect", true) ? this.inspect(go) : Promise.resolve(undefined),
    ]);
    this.manifests = manifests;
    if (inspection) {
      this.inspection = inspection;
      this.embedded = await embeddedIn(this.root);
    }
  }

  private async inspect(go: string): Promise<Inspection | undefined> {
    // Built the way `collage dev` builds it (collage v0.46.0), not with `go run`:
    // the collage_dev tag leaves the scaffold's embed.go out, and a build into a
    // file of our own is not one the Go build cache keeps. `go run` stores the
    // linked executable there, and the embedded templates and static files with
    // the compiled main package: another copy of both on every save, kept for
    // days. Built without the embedded copies, the program has to read them from
    // disk, which is what development mode does.
    const binary = path.join(os.tmpdir(), `collage-inspect-${process.pid}-${++builds}${process.platform === "win32" ? ".exe" : ""}`);
    try {
      await exec(go, ["build", "-tags", "collage_dev", "-o", binary, "."], this.root, 120_000);
      // Runs the application's own main, which answers collage-inspect with
      // App.Inspect: the only way to know what it registers is to register it.
      const out = await exec(binary, ["collage-inspect"], this.root, 60_000, { COLLAGE_DEV: "1" });
      const inspection = JSON.parse(out) as Inspection;
      this.error = undefined;
      this.log.appendLine(`[${this.root}] inspected: ${inspection.pages.length} pages, ${inspection.fragments.length} fragments`);
      return inspection;
    } catch (err) {
      this.error = String(err instanceof Error ? err.message : err).split("\n").slice(0, 12).join("\n");
      this.log.appendLine(`[${this.root}] collage-inspect failed:\n${this.error}`);
      return undefined;
    } finally {
      await fs.rm(binary, { force: true });
    }
  }

  private async readManifests(go: string): Promise<Manifest[]> {
    let listing: string;
    try {
      listing = await exec(go, ["list", "-m", "-json", "all"], this.root, 60_000);
    } catch (err) {
      this.log.appendLine(`[${this.root}] go list failed: ${err}`);
      return [];
    }
    const out: Manifest[] = [];
    for (const mod of parseStream(listing)) {
      if (!mod.Dir) continue;
      try {
        const body = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(mod.Dir, "collage.json")));
        const manifest = JSON.parse(new TextDecoder().decode(body)) as Manifest;
        if (manifest.name) out.push(manifest);
      } catch {
        // No collage.json: a module that is not a plugin, or one that says nothing.
      }
    }
    this.log.appendLine(`[${this.root}] manifests: ${out.map((m) => m.name).join(", ") || "none"}`);
    return out;
  }

  /** The name a template file has in the application: its path under the template root. */
  templateName(file: string): string | undefined {
    const rootDir = path.join(this.root, this.inspection?.templateRoot || "templates");
    const rel = path.relative(rootDir, file);
    return rel.startsWith("..") ? undefined : rel.split(path.sep).join("/");
  }
}

/** embeddedIn reads the Go files under root for the fields their structs embed. */
async function embeddedIn(root: string): Promise<Set<string>> {
  const out = new Set<string>();
  let files = 0;
  const visit = async (dir: string): Promise<void> => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (files > 5000) return;
      if (e.isDirectory()) {
        if (!e.name.startsWith(".") && e.name !== "vendor" && e.name !== "node_modules") await visit(path.join(dir, e.name));
      } else if (e.name.endsWith(".go")) {
        files++;
        try {
          for (const name of embeddedFields(await fs.readFile(path.join(dir, e.name), "utf8"))) out.add(name);
        } catch {
          // an unreadable file embeds nothing we can see
        }
      }
    }
  };
  await visit(root);
  return out;
}

/** `go list -m -json` prints a stream of JSON objects, not an array. */
function parseStream(text: string): { Path: string; Dir?: string }[] {
  const out: { Path: string; Dir?: string }[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "}" && --depth === 0 && start >= 0) {
      try {
        out.push(JSON.parse(text.slice(start, i + 1)));
      } catch {
        // skip a malformed object
      }
    }
  }
  return out;
}

/** Numbers the inspection builds, so two projects never build into one file. */
let builds = 0;

function exec(cmd: string, args: string[], cwd: string, timeout: number, env: Record<string, string> = { COLLAGE_DEV: "" }): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile(cmd, args, { cwd, timeout, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args.join(" ")}: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });
}

/** Finds the collage projects in the workspace and hands out the one a file is in. */
export class Projects implements vscode.Disposable {
  private readonly projects = new Map<string, Project>();
  private discovered: Promise<void> | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  readonly log = vscode.window.createOutputChannel("Collage");
  private readonly status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  private timer: NodeJS.Timeout | undefined;

  constructor() {
    this.status.command = "collage.refresh";
    const watcher = vscode.workspace.createFileSystemWatcher("**/go.mod");
    const rediscover = () => {
      this.discovered = undefined;
      this.projects.clear();
      void this.all().then((ps) => ps.forEach((p) => void p.refresh()));
    };
    watcher.onDidChange(rediscover);
    watcher.onDidCreate(rediscover);
    watcher.onDidDelete(rediscover);
    this.disposables.push(
      watcher,
      this.log,
      this.status,
      this.changed,
      // A saved Go file may have registered a page, bound a slot, added a plugin.
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId !== "go" && !doc.fileName.endsWith("go.mod")) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.forFile(doc.fileName).then((p) => p?.refresh()), 1500);
      }),
    );
  }

  async all(): Promise<Project[]> {
    this.discovered ??= this.discover();
    await this.discovered;
    return [...this.projects.values()];
  }

  private async discover(): Promise<void> {
    const mods = await vscode.workspace.findFiles("**/go.mod", "**/{node_modules,vendor}/**", 50);
    for (const uri of mods) {
      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      if (/github\.com\/Elagoht\/collage\s/.test(text)) {
        const root = path.dirname(uri.fsPath);
        if (!this.projects.has(root)) this.projects.set(root, new Project(root, this.log, () => this.update()));
      }
    }
    this.update();
  }

  /** The project whose root is the nearest ancestor of file, if any. */
  async forFile(file: string): Promise<Project | undefined> {
    const projects = await this.all();
    let best: Project | undefined;
    for (const p of projects) {
      if ((file === p.root || file.startsWith(p.root + path.sep)) && (!best || p.root.length > best.root.length)) best = p;
    }
    return best;
  }

  private update(): void {
    const ps = [...this.projects.values()];
    if (ps.length === 0) {
      this.status.hide();
    } else {
      const failed = ps.filter((p) => p.error);
      const pages = ps.reduce((n, p) => n + (p.inspection?.pages.length ?? 0), 0);
      this.status.text = failed.length ? "$(warning) collage" : `$(layers) collage: ${pages} pages`;
      this.status.tooltip = failed.length
        ? `collage-inspect failed — completion falls back to what the extension knows. Click to retry; details in the Collage output.\n\n${failed[0].error}`
        : "What collage knows of this project. Click to refresh.";
      this.status.show();
    }
    this.changed.fire();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposables.forEach((d) => d.dispose());
  }
}
