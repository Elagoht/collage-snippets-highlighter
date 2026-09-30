// The inline injection against the grammars VS Code itself ships — Go, HTML,
// JavaScript and CSS — rather than stand-ins: a stand-in cannot say whether the
// real Go grammar claims a line first, or whether HTML's <script> reaches
// JavaScript. Skipped where VS Code is not installed (VSCODE_APP overrides).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vsctm from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const app = process.env.VSCODE_APP ?? "/Applications/Visual Studio Code.app/Contents/Resources/app";
const ext = `${app}/extensions`;
const installed = existsSync(`${ext}/go/syntaxes/go.tmLanguage.json`);

const require = createRequire(import.meta.url);
const json = (path) => JSON.parse(readFileSync(path));
const own = (name) => json(new URL(`../syntaxes/${name}`, import.meta.url));

let grammar;
if (installed) {
  await oniguruma.loadWASM(readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer);
  const inline = own("collage-inline.tmLanguage.json");
  const template = own("collage-template.tmLanguage.json");
  const grammars = {
    "source.go": json(`${ext}/go/syntaxes/go.tmLanguage.json`),
    "text.html.basic": json(`${ext}/html/syntaxes/html.tmLanguage.json`),
    "source.js": json(`${ext}/javascript/syntaxes/JavaScript.tmLanguage.json`),
    "source.css": json(`${ext}/css/syntaxes/css.tmLanguage.json`),
    [inline.scopeName]: inline,
    [template.scopeName]: template,
  };
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({ createOnigScanner: (p) => new oniguruma.OnigScanner(p), createOnigString: (s) => new oniguruma.OnigString(s) }),
    loadGrammar: async (scope) => grammars[scope] ?? null,
    getInjections: (scope) => (scope === "source.go" ? [inline.scopeName, template.scopeName] : undefined),
  });
  grammar = await registry.loadGrammar("source.go");
}

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
const scopes = (tokens, text) => tokens.find(([t]) => t.trim() === text)?.[1] ?? [];
const has = (tokens, text, scope) => scopes(tokens, text).some((s) => s.startsWith(scope));

test("with VS Code's grammars: arguments on lines of their own", { skip: !installed }, () => {
  const tokens = tokenize([
    "func Row() *collage.Fragment {",
    "\treturn collage.NewInlineFragment(",
    "\t\t\"row\",",
    "\t\t`<tr>{{slot \"cells\"}}</tr>`,",
    "\t).Build()",
    "}",
    "var after = 1",
  ]);
  assert.ok(has(tokens, "tr", "entity.name.tag.html"), "the template is HTML");
  assert.ok(has(tokens, "slot", "support.function.collage"), "with collage's functions");
  assert.ok(!scopes(tokens, "after").some((s) => s.includes("embedded")), "Go resumes after the call");
});

test("with VS Code's grammars: a declaration's raw string on the next line", { skip: !installed }, () => {
  const tokens = tokenize(["const row collage.InlineHTML =", "\t`<p>{{.T}}</p>`", "var after = 1"]);
  assert.ok(has(tokens, "p", "entity.name.tag.html"));
  assert.ok(!scopes(tokens, "after").some((s) => s.includes("embedded")));
});

test("with VS Code's grammars: <script> is JavaScript and <style> is CSS", { skip: !installed }, () => {
  const tokens = tokenize([
    "const box collage.InlineHTML = `",
    "<script nonce=\"{{cspNonce}}\">",
    "  var pencil = document.querySelector(\".x\");",
    "  if (pencil) { pencil.hidden = true; }",
    "</script>",
    "<style>.a { color: red; }</style>",
    "`",
  ]);
  assert.ok(has(tokens, "var", "storage.type.js"), "var is a JavaScript keyword");
  assert.ok(has(tokens, "if", "keyword.control.conditional.js"));
  assert.ok(has(tokens, "color", "support.type.property-name.css"), "color is a CSS property");
});
