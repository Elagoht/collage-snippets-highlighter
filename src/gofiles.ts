// What the extension reads of a project's files once per inspection: the
// directory its templates are under, the fields its structs embed and the
// constants it passes to NewInlineFragment. Kept free of the vscode API so it can
// be tested in Node.
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { embeddedFields } from "./datatypes";
import { inlineUses } from "./embedded";
import type { Inspection, InspectedType } from "./project";

/** listsEmbedded is whether a type table marks embedded fields, as collage
 * v0.51.1 does; one that marks none may be older, and the Go source is read for
 * them instead. */
export function listsEmbedded(types: Record<string, InspectedType> | undefined): boolean {
  return Object.values(types ?? {}).some((t) => t.fields?.some((f) => f.embedded));
}

/**
 * findTemplateDir is the directory the fragments' template paths resolve under:
 * the inspection's templateRoot under the project, unless no template is there —
 * a template file system rooted elsewhere, os.DirFS("templates") with Root "." —
 * and then the first directory below the project they all resolve under.
 */
export async function findTemplateDir(root: string, inspection: Inspection): Promise<string> {
  const declared = path.join(root, inspection.templateRoot || "templates");
  const ext = inspection.templateExtension || "";
  const templates = [...new Set(inspection.fragments.filter((f) => !f.inline && f.template).map((f) => f.template))].slice(0, 3);
  if (templates.length === 0) return declared;
  const exists = async (file: string) => fs.access(file).then(() => true, () => false);
  const resolves = async (dir: string) => {
    for (const t of templates) if (!(await exists(path.join(dir, t))) && !(await exists(path.join(dir, t + ext)))) return false;
    return true;
  };
  if (await resolves(declared)) return declared;
  const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  for (let seen = 0; queue.length && seen < 2000; seen++) {
    const { dir, depth } = queue.shift()!;
    if (await resolves(dir)) return dir;
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
  return declared;
}

/** scanGo reads the Go files under root once: the fields their structs embed
 * (when asked) and the constants each passes to NewInlineFragment. */
export async function scanGo(root: string, wantEmbedded: boolean): Promise<{ embedded: Set<string>; uses: Map<string, Map<string, string[]>> }> {
  const out = new Set<string>();
  const uses = new Map<string, Map<string, string[]>>();
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
          const file = path.join(dir, e.name);
          const text = await fs.readFile(file, "utf8");
          if (wantEmbedded) for (const name of embeddedFields(text)) out.add(name);
          if (text.includes("NewInlineFragment")) uses.set(file, inlineUses(text));
        } catch {
          // an unreadable file says nothing we can see
        }
      }
    }
  };
  await visit(root);
  return { embedded: out, uses };
}
