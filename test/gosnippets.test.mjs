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
  for (const prefix of ["cpage", "cfragf", "cfrag", "clayout", "cguard"]) {
    assert.ok(byPrefix[prefix], `missing ${prefix}`);
    assert.ok(byPrefix[prefix].imports.includes(COLLAGE_IMPORT), `${prefix} imports collage`);
  }
  assert.ok(byPrefix.cpage.body.join("\n").includes("WithLayouts("), "cpage uses WithLayouts");
  assert.ok(byPrefix.cpage.body.join("\n").includes("layouts.Master()"), "cpage wraps the scaffold's layout");
  assert.ok(byPrefix.cfrag.body.join("\n").includes("NewInlineFragment("));
  assert.ok(byPrefix.cfrag.body.join("\n").includes("collage.InlineHTML"), "cfrag keeps its markup in an InlineHTML const");
  assert.deepEqual([...byPrefix.cguard.imports].sort(), ["context", "net/http", COLLAGE_IMPORT].sort());
  const fragf = byPrefix.cfragf.body.find((l) => l.startsWith("func "));
  assert.ok(fragf && fragf.includes("*collage.Fragment"), "cfragf is a function returning a fragment");
});

// expand fills every placeholder with its default, as accepting a snippet with
// Tab does, and unescapes what the snippet syntax escapes.
function expand(body) {
  let text = body.join("\n");
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text
      .replace(/\$\{\d+\|([^,|}]*)[^}]*\|\}/g, "$1")
      .replace(/\$\{\d+:((?:[^{}\\]|\\.)*)\}/g, "$1")
      .replace(/\$\{\d+\}|\$\d+/g, "");
  }
  return text.replace(/\\([}$\\])/g, "$1");
}

// The package a path is imported as: its last element, "collage-" dropped.
const importName = (p) => p.split("/").pop().replace(/^collage-/, "").replace(/-/g, "");

test("every function snippet is Go that parses, and uses each import it adds", async () => {
  const { execFileSync } = await import("node:child_process");
  for (const s of functionSnippets) {
    const body = expand(s.body);
    const topLevel = /^(\/\/[^\n]*\n)*(func|const|type|var) /.test(body);
    const imports = s.imports.map((p) => `import "${p}"`).join("\n");
    const src = `package p\n\n${imports}\n\n${topLevel ? body : `func _() (any, error) {\n${body}\n}`}\n`;
    try {
      execFileSync("gofmt", ["-e"], { input: src, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      assert.fail(`${s.prefix} does not parse:\n${e.stderr}\n${src}`);
    }
    for (const p of s.imports) {
      const name = importName(p);
      assert.ok(new RegExp(`\\b${name}\\.`).test(body), `${s.prefix} imports ${p} but does not use ${name}.`);
    }
  }
});

test("function snippet prefixes are unique, and there are no static Go snippets beside them", async () => {
  const { readFileSync } = await import("node:fs");
  const prefixes = functionSnippets.map((s) => s.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length, "duplicate function snippet prefix");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.ok(!pkg.contributes.snippets.some((s) => s.language === "go"), "a static Go snippet file is contributed");
});

test("exported functions are documented, and no snippet is untyped", () => {
  for (const s of functionSnippets) {
    s.body.forEach((line, i) => {
      if (/^func (\(p \*Plugin\) )?[A-Z$]/.test(line) && !/^func \(p \*Plugin\) (Name|Version|Shutdown)\(/.test(line) && !/^func Test/.test(line) && !/^func New\(opts/.test(line)) {
        assert.ok(i > 0 && s.body[i - 1].startsWith("//"), `${s.prefix}: ${line} has no comment above it`);
      }
    });
    assert.ok(!/\bany\b/.test(s.body.join("\n")), `${s.prefix} uses any`);
  }
});

test("the snippets a validated form's action is written with", () => {
  const byPrefix = Object.fromEntries(functionSnippets.map((s) => [s.prefix, s]));
  for (const prefix of ["cpagea", "cact", "cactp", "cactf", "cval", "cvf", "cvfail", "cvfields", "cflash", "credir", "cfragd", "cmeta", "cjsonld",
    "cfrags", "cstate", "cnotfound", "cpage404", "cfrag404", "chtml", "creg", "ccookie", "cparam"]) {
    assert.ok(byPrefix[prefix], `missing ${prefix}`);
  }
  const action = byPrefix.cactf.body.join("\n");
  for (const want of ["validate.Form(rc)", "validate.Refuse(rc, v, rc.Page)", "flash.Add(", "rc.URL(", "collage.SeeOther("]) {
    assert.ok(action.includes(want), `cactf lacks ${want}`);
  }
});
