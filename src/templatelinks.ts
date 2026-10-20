// Template paths in Go: `NewFragment("layout", "layouts/master.html")` names a
// file under the template root, and Cmd/Ctrl+click on the path opens it. The
// only constructor collage has that takes a template path is NewFragment, its
// second argument; NewInlineFragment's is the template itself. Kept free of the
// vscode API so it can be tested in Node.
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tokens, callArgs, stringValue } from "./embedded";

/** A template path written as a string literal: its value, and the offsets of
 * its text, the quotes excluded. */
export interface TemplatePath {
  value: string;
  start: number;
  end: number;
}

/** templatePaths are the template paths of a Go file that are NewFragment's
 * second argument and a closed string literal on their own. */
export function templatePaths(go: string): TemplatePath[] {
  const toks = tokens(go);
  const out: TemplatePath[] = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "ident" || toks[i].text !== "NewFragment" || toks[i + 1]?.text !== "(") continue;
    const { args } = callArgs(toks, i + 1);
    const lit = args[1]?.length === 1 ? args[1][0] : undefined;
    // A literal still being typed has no closing quote, and is not a path yet.
    if (!lit || lit.text.length < 2 || !/^(".*"|`[^]*`)$/.test(lit.text)) continue;
    const value = stringValue(lit);
    if (value) out.push({ value, start: lit.start + 1, end: lit.end - 1 });
  }
  return out;
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
