// The Go function snippets: which package a new file belongs to, and what has to
// be added above a snippet for the file to compile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { packageName, hasPackageClause, headerEdits, functionSnippets, COLLAGE_IMPORT } = require("../out/src/gosnippets.js");

// apply applies insertions, last first, so earlier offsets stay valid.
const apply = (text, edits) =>
  [...edits].sort((a, b) => b.offset - a.offset).reduce((t, e) => t.slice(0, e.offset) + e.text + t.slice(e.offset), text);

test("the package of a sibling file wins", () => {
  const siblings = [{ file: "master.go", text: "// Package layouts is the site's layouts.\npackage layouts\n" }];
  assert.equal(packageName({ dir: "/app/layouts", siblings, moduleRoot: false }), "layouts");
});

test("a sibling test file's external package gives its base name", () => {
  const siblings = [{ file: "x_test.go", text: "package layouts_test\n" }];
  assert.equal(packageName({ dir: "/app/whatever", siblings, moduleRoot: false }), "layouts");
});

test("a file beside go.mod is main", () => {
  assert.equal(packageName({ dir: "/app", siblings: [], moduleRoot: true }), "main");
});

test("otherwise the directory, made a Go identifier", () => {
  assert.equal(packageName({ dir: "/app/layouts", siblings: [], moduleRoot: false }), "layouts");
  assert.equal(packageName({ dir: "/app/auth-layout", siblings: [], moduleRoot: false }), "authlayout");
  assert.equal(packageName({ dir: "/app/Pages", siblings: [], moduleRoot: false }), "pages");
  assert.equal(packageName({ dir: "/app/2fa", siblings: [], moduleRoot: false }), "p2fa");
});

test("a package clause is found past comments, not inside them", () => {
  assert.equal(hasPackageClause("// Package x.\npackage x\n"), true);
  assert.equal(hasPackageClause("// package x is mentioned here\n"), false);
  assert.equal(hasPackageClause("/*\npackage x\n*/\n"), false);
  assert.equal(hasPackageClause(""), false);
});

test("an empty file gets its package and imports", () => {
  const out = apply("", headerEdits("", "layouts", [COLLAGE_IMPORT]));
  assert.equal(out, `package layouts\n\nimport "${COLLAGE_IMPORT}"\n\n`);
});

test("a file with a package and no imports gets an import after the clause", () => {
  const text = "package layouts\n\nfunc a() {}\n";
  const out = apply(text, headerEdits(text, "ignored", [COLLAGE_IMPORT, "context"]));
  assert.equal(out, `package layouts\n\nimport (\n\t"context"\n\t"${COLLAGE_IMPORT}"\n)\n\nfunc a() {}\n`);
});

test("a grouped import block gets the missing paths inside it", () => {
  const text = `package pages\n\nimport (\n\t"context"\n)\n\nfunc a() {}\n`;
  const out = apply(text, headerEdits(text, "ignored", [COLLAGE_IMPORT, "context", "net/http"]));
  assert.equal(out, `package pages\n\nimport (\n\t"context"\n\t"net/http"\n\t"${COLLAGE_IMPORT}"\n)\n\nfunc a() {}\n`);
});

test("a single-line import is followed by the missing ones", () => {
  const text = `package pages\n\nimport "fmt"\n\nfunc a() {}\n`;
  const out = apply(text, headerEdits(text, "ignored", [COLLAGE_IMPORT]));
  assert.equal(out, `package pages\n\nimport "fmt"\nimport "${COLLAGE_IMPORT}"\n\nfunc a() {}\n`);
});

test("nothing is added when the file has it all", () => {
  const text = `package pages\n\nimport (\n\t"context"\n\n\t"${COLLAGE_IMPORT}"\n)\n`;
  assert.deepEqual(headerEdits(text, "ignored", [COLLAGE_IMPORT, "context"]), []);
});

test("an aliased collage import counts as imported", () => {
  const text = `package pages\n\nimport c "${COLLAGE_IMPORT}"\n`;
  assert.deepEqual(headerEdits(text, "ignored", [COLLAGE_IMPORT]), []);
});

test("the function snippets", () => {
  const byPrefix = Object.fromEntries(functionSnippets.map((s) => [s.prefix, s]));
  for (const prefix of ["cpagef", "cfragf", "cinlinef", "clayoutf", "cguardf"]) {
    assert.ok(byPrefix[prefix], `missing ${prefix}`);
    assert.ok(byPrefix[prefix].imports.includes(COLLAGE_IMPORT), `${prefix} imports collage`);
  }
  assert.ok(byPrefix.cpagef.body.join("\n").includes("WithLayouts("), "cpagef uses WithLayouts");
  assert.ok(!byPrefix.cpagef.body.join("\n").includes("WithLayout("), "cpagef has no WithLayout");
  assert.ok(byPrefix.cinlinef.body.join("\n").includes("NewInlineFragment("));
  assert.deepEqual([...byPrefix.cguardf.imports].sort(), ["context", "net/http", COLLAGE_IMPORT].sort());
  assert.ok(byPrefix.cfragf.body[0].startsWith("func "), "cfragf is a function");
  assert.ok(byPrefix.cfragf.body[0].includes("*collage.Fragment"), "cfragf returns a fragment");
});
