// Keeps the catalog honest: every function collage and its published plugins
// register is in it, and nothing else. The checks against the sources run when
// the repos are cloned beside this one (as in development) and skip otherwise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url)));
const names = (src) => catalog.functions.filter((f) => (src === "collage" ? f.source === "collage" : f.source !== "collage")).map((f) => f.name).sort();
const root = process.env.COLLAGE_SRC ?? join(homedir(), "Desktop");

test("every function is described", () => {
  for (const f of catalog.functions) {
    assert.ok(f.name && f.signature.startsWith(f.name) && f.insert.startsWith(f.name) && f.doc, `incomplete: ${f.name}`);
    assert.ok(f.source === "collage" ? f.link : f.repo, `no link: ${f.name}`);
  }
  assert.equal(new Set(catalog.functions.map((f) => f.name)).size, catalog.functions.length, "a name is listed twice");
});

test("collage's own functions match its DefaultFuncs", { skip: !existsSync(join(root, "collage/internal/template/funcs.go")) }, () => {
  const src = readFileSync(join(root, "collage/internal/template/funcs.go"), "utf8");
  const block = src.slice(src.indexOf("func DefaultFuncs()"), src.indexOf("\n}\n", src.indexOf("func DefaultFuncs()")));
  const found = [...block.matchAll(/"([A-Za-z]+)":/g)].map((m) => m[1]).sort();
  assert.deepEqual(names("collage"), found);
});

test("the plugins' functions match what they register", { skip: !existsSync(join(root, "collage-live")) }, () => {
  const found = new Set();
  for (const dir of readdirSync(root).filter((d) => d.startsWith("collage-"))) {
    let files;
    try {
      files = readdirSync(join(root, dir)).filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"));
    } catch {
      continue;
    }
    for (const f of files) {
      const src = readFileSync(join(root, dir, f), "utf8");
      for (const m of src.matchAll(/Add(?:Template|Render)Func\("([A-Za-z]+)"/g)) found.add(m[1]);
      // Registered in a loop over a map literal of factories, as collage-i18n and
      // collage-validate do.
      for (const m of src.matchAll(/map\[string\]func\(rc \*collage\.RenderContext\) any\{[^\n]*\n([\s\S]*?)\n\t\}/g)) {
        for (const n of m[1].matchAll(/^\t\t"([A-Za-z]+)": func/gm)) found.add(n[1]);
      }
    }
  }
  assert.deepEqual(names("plugins"), [...found].sort());
});

test("snippets are valid and every prefix is unique per language", () => {
  for (const file of ["go", "html"]) {
    const snippets = JSON.parse(readFileSync(new URL(`../snippets/${file}.json`, import.meta.url)));
    const prefixes = Object.values(snippets).map((s) => s.prefix);
    assert.equal(new Set(prefixes).size, prefixes.length, `${file}: a prefix is used twice`);
    for (const [name, s] of Object.entries(snippets)) assert.ok(s.body?.length && s.description, `${file}: ${name}`);
  }
});
