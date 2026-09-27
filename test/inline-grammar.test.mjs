// Tokenizes Go with the engine VS Code uses, through the injection that colours
// NewInlineFragment's template as HTML with collage's template actions in it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vsctm from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer;
await oniguruma.loadWASM(wasm);

const read = (name) => JSON.parse(readFileSync(new URL(`../syntaxes/${name}`, import.meta.url)));
const inline = read("collage-inline.tmLanguage.json");
const template = read("collage-template.tmLanguage.json");

// Stand-ins for VS Code's Go and HTML grammars: Go's raw string is what the
// template would otherwise be coloured as, and a tag is enough of HTML.
const go = {
  scopeName: "source.go",
  patterns: [
    { name: "string.quoted.raw.go", begin: "`", end: "`" },
    { name: "string.quoted.double.go", begin: "\"", end: "\"" },
    { name: "variable.other.go", match: "\\b[A-Za-z_]\\w*\\b" },
  ],
};
const html = {
  scopeName: "text.html.basic",
  patterns: [{ name: "meta.tag.html", begin: "<[a-z]+", end: ">" }],
};

const registry = new vsctm.Registry({
  onigLib: Promise.resolve({ createOnigScanner: (p) => new oniguruma.OnigScanner(p), createOnigString: (s) => new oniguruma.OnigString(s) }),
  loadGrammar: async (scope) =>
    ({ "source.go": go, "text.html.basic": html, [inline.scopeName]: inline, [template.scopeName]: template })[scope] ?? null,
  // VS Code asks for the injections of the root grammar only, so the template
  // grammar reaches Go's embedded HTML by being injected into source.go too; its
  // selector keeps it to text.html scopes, which only the embedded block has.
  getInjections: (scope) => (scope === "source.go" ? [inline.scopeName, template.scopeName] : undefined),
});
const grammar = await registry.loadGrammar("source.go");

// tokenize returns, per line, each token's text with its full scope stack.
function tokenize(lines) {
  let state = vsctm.INITIAL;
  const out = [];
  for (const line of lines) {
    const r = grammar.tokenizeLine(line, state);
    for (const t of r.tokens) out.push([line.slice(t.startIndex, t.endIndex), t.scopes]);
    state = r.ruleStack;
  }
  return out;
}
const scopes = (tokens, text) => tokens.find(([t]) => t === text)?.[1] ?? [];

test("an inline fragment's template is HTML, across lines", () => {
  const tokens = tokenize([
    "row := collage.NewInlineFragment(\"post-row\", `",
    "  <tr>",
    "    <td>{{slot \"cells\"}}</td>",
    "  </tr>`).Build()",
  ]);
  assert.ok(scopes(tokens, "<tr").includes("meta.tag.html"), "the tag is HTML");
  assert.ok(scopes(tokens, "<tr").includes("meta.embedded.block.html"), "inside the embedded block");
  assert.ok(!scopes(tokens, "<tr").includes("string.quoted.raw.go"), "not a Go string");
  assert.ok(scopes(tokens, "slot").includes("support.function.collage.core"), "collage functions are coloured inside it");
  assert.ok(scopes(tokens, "Build").includes("variable.other.go"), "Go resumes after the closing backtick");
  assert.ok(!scopes(tokens, "Build").includes("meta.embedded.block.html"));
});

test("on one line too", () => {
  const tokens = tokenize(["collage.NewInlineFragment(\"x\", `<p>{{.Title}}</p>`).Build()"]);
  assert.ok(scopes(tokens, "<p").includes("meta.tag.html"));
  assert.ok(scopes(tokens, "Build").includes("variable.other.go"));
});

test("other raw strings stay Go strings", () => {
  const tokens = tokenize(["q := `<p>not a template</p>`"]);
  assert.ok(tokens.some(([, s]) => s.includes("string.quoted.raw.go")));
  assert.ok(!tokens.some(([, s]) => s.includes("meta.embedded.block.html")));
});

test("a file fragment's path is not HTML", () => {
  const tokens = tokenize(["collage.NewFragment(\"x\", \"pages/x.html\")"]);
  assert.ok(!tokens.some(([, s]) => s.includes("meta.embedded.block.html")));
});
