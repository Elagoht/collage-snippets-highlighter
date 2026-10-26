// Template paths in Go: `NewFragment("layout", "layouts/master.html")` names a
// file under the template root, and Cmd/Ctrl+click on the path opens it. The
// only constructor collage has that takes a template path is NewFragment, its
// second argument; NewInlineFragment's is the template itself. Kept free of the
// vscode API so it can be tested in Node.
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tokens, callArgs, stringValue, type GoToken } from "./embedded";

/** A template path written as a string literal: its value, and the offsets of
 * its text, the quotes excluded. */
export interface TemplatePath {
  value: string;
  start: number;
  end: number;
}

/** templatePaths are the template paths of a Go file: NewFragment's second
 * argument when it is a closed string literal on its own, or the literal a const
 * or variable of this file holds when that is passed there. */
export function templatePaths(go: string): TemplatePath[] {
  const toks = tokens(go);
  const out: TemplatePath[] = [];
  const held = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "ident" || toks[i].text !== "NewFragment" || toks[i + 1]?.text !== "(") continue;
    const { args } = callArgs(toks, i + 1);
    if (args[1]?.length !== 1) continue;
    if (args[1][0].kind === "ident") held.add(args[1][0].text);
    else push(out, args[1][0]);
  }
  if (held.size === 0) return out;
  // `name = "…"`, `name := "…"`, `name string = "…"`: in a const or var
  // declaration, or an assignment, anywhere in the file.
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.kind !== "ident" || !held.has(t.text) || toks[k - 1]?.text === ".") continue;
    let a = k + 1;
    if (toks[a]?.kind === "ident") a++; // a type
    if (toks[a]?.text === ":") a++;
    if (toks[a]?.text !== "=" || toks[a + 1]?.text === "=") continue;
    const lit = toks[a + 1];
    if (lit && toks[a + 2]?.text !== "+") push(out, lit);
  }
  return out.sort((x, y) => x.start - y.start);
}

/** push adds a closed, non-empty string literal as a path. */
function push(out: TemplatePath[], lit: GoToken): void {
  // A literal still being typed has no closing quote, and is not a path yet.
  if (lit.text.length < 2 || !/^(".*"|`[^]*`)$/.test(lit.text)) return;
  const value = stringValue(lit);
  if (value) out.push({ value, start: lit.start + 1, end: lit.end - 1 });
}

/** templatePathAt is the template path whose literal the offset is in, either quote included. */
export function templatePathAt(go: string, offset: number): TemplatePath | undefined {
  return templatePaths(go).find((p) => offset >= p.start - 1 && offset <= p.end + 1);
}

/** resolveTemplate is the file a template path names under dir — as written, or
 * with the extension, as the rest of the extension looks a template up — when it
 * exists and is under dir. */
export async function resolveTemplate(dir: string, value: string, ext: string): Promise<string | undefined> {
  for (const candidate of ext && !value.endsWith(ext) ? [value, value + ext] : [value]) {
    const file = path.join(dir, candidate);
    if (path.relative(dir, file).startsWith("..")) return undefined;
    const isFile = await fs.stat(file).then((s) => s.isFile(), () => false);
    if (isFile) return file;
  }
  return undefined;
}

/**
 * findTemplate is the file a template path names: under the template directory
 * when it is there; otherwise under whichever directory of the project it is
 * found — Config.Template.Root before an inspection has said what it is, or
 * when the application cannot start to say it. Every match, nearest first;
 * none when there is none.
 */
export async function findTemplate(root: string, templateDir: string, value: string, ext: string): Promise<string[]> {
  const direct = await resolveTemplate(templateDir, value, ext);
  if (direct) return [direct];
  const out: string[] = [];
  const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  for (let seen = 0; queue.length && seen < 2000; seen++) {
    const { dir, depth } = queue.shift()!;
    if (dir !== templateDir) {
      const file = await resolveTemplate(dir, value, ext);
      if (file) out.push(file);
    }
    if (depth >= 4) continue;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "vendor" && e.name !== "node_modules") queue.push({ dir: path.join(dir, e.name), depth: depth + 1 });
    }
  }
  return out;
}
