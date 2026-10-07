// What is read of a project's files once per inspection.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { listsEmbedded, findTemplateDir, scanGo } = require("../out/src/gofiles.js");

const project = (files) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "collage-gofiles-")));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
};
const inspection = (templateRoot, templates) => ({ templateRoot, templateExtension: ".html", fragments: templates.map((t, i) => ({ name: "f" + i, template: t })) });

test("the template directory: the declared root, or where the templates are", async () => {
  const root = project({ "templates/pages/home.html": "", "templates/admin/pages/home.html": "" });
  assert.equal(await findTemplateDir(root, inspection("templates", ["pages/home.html"])), join(root, "templates"));
  // os.DirFS("templates") with Root ".": the templates are found under templates/,
  // and admin/pages/home.html maps to no fragment, since paths match exactly.
  assert.equal(await findTemplateDir(root, inspection(".", ["pages/home.html"])), join(root, "templates"));
  const other = project({ "web/views/pages/home.html": "" });
  assert.equal(await findTemplateDir(other, inspection(".", ["pages/home.html"])), join(other, "web/views"));
  assert.equal(await findTemplateDir(other, inspection("tpl", ["pages/missing.html"])), join(other, "tpl"), "found nowhere: the declared root");
});

test("the type table decides whether embedded fields are read from source", () => {
  assert.equal(listsEmbedded({ "a.P": { kind: "struct", fields: [{ name: "Base", type: "a.Base", embedded: true }] } }), true);
  assert.equal(listsEmbedded({ "a.P": { kind: "struct", fields: [{ name: "ID", type: "int" }] } }), false, "a table from before v0.51.1, or no embedding: read the source");
  assert.equal(listsEmbedded(undefined), false);
});

test("Go files read once: embedded fields when asked, NewInlineFragment's constants", async () => {
  const root = project({
    "a/a.go": "package a\ntype P struct {\n\tBase\n}\nvar f = collage.NewInlineFragment(\"row\", rowHTML)\n",
    "a/b.go": "package a\nconst rowHTML collage.InlineHTML = `{{.X}}`\n",
    "vendor/v/v.go": "package v\ntype Q struct { Hidden }\n",
  });
  const scan = await scanGo(root, true);
  assert.deepEqual([...scan.embedded], ["Base"]);
  assert.deepEqual([...scan.uses.get(join(root, "a/a.go"))], [["rowHTML", ["row"]]]);
  assert.equal(scan.uses.has(join(root, "a/b.go")), false);
  assert.deepEqual([...(await scanGo(root, false)).embedded], []);
});
