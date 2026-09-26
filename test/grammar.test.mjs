// Tokenizes templates with the engine VS Code uses, through the injection the
// extension contributes, and checks what each piece is coloured as.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vsctm from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer;
await oniguruma.loadWASM(wasm);

const injection = JSON.parse(readFileSync(new URL("../syntaxes/collage-template.tmLanguage.json", import.meta.url)));
// A stand-in for VS Code's HTML grammar: the injection targets its scope, and a
// quoted attribute value is where templates most often sit.
const html = {
  scopeName: "text.html.basic",
  patterns: [
    { name: "comment.block.html", begin: "<!--", end: "-->" },
    { name: "meta.tag.html", begin: "<[a-z]+", end: ">", patterns: [{ name: "string.quoted.double.html", begin: "\"", end: "\"" }] },
  ],
};

const registry = new vsctm.Registry({
  onigLib: Promise.resolve({ createOnigScanner: (p) => new oniguruma.OnigScanner(p), createOnigString: (s) => new oniguruma.OnigString(s) }),
  loadGrammar: async (scope) => (scope === "text.html.basic" ? html : scope === injection.scopeName ? injection : null),
  getInjections: (scope) => (scope === "text.html.basic" ? [injection.scopeName] : undefined),
});
const grammar = await registry.loadGrammar("text.html.basic");

// scopesOf returns, for each token text, its innermost scope.
function scopesOf(line) {
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL);
  return tokens.map((t) => [line.slice(t.startIndex, t.endIndex), t.scopes.at(-1)]);
}
const scopeOf = (line, text) => scopesOf(line).find(([t]) => t === text)?.[1];

test("collage functions are coloured apart from Go's builtins and from plugins'", () => {
  assert.equal(scopeOf(`{{slot "content"}}`, "slot"), "support.function.collage.core");
  assert.equal(scopeOf(`{{pageURL "home"}}`, "pageURL"), "support.function.collage.core");
  assert.equal(scopeOf(`{{asset "/static/app.css"}}`, "asset"), "support.function.collage.core");
  assert.equal(scopeOf(`{{t "nav.home"}}`, "t"), "support.function.collage.plugin");
  assert.equal(scopeOf(`{{if eq .A .B}}`, "eq"), "support.function.builtin.collage-template");
  assert.equal(scopeOf(`{{if eq .A .B}}`, "if"), "keyword.control.collage-template");
});

test("strings, fields, variables, pipes and delimiters", () => {
  const line = `{{- range $i, $p := .Posts | slice 0 3 -}}`;
  assert.equal(scopeOf(line, "{{-"), "punctuation.section.embedded.begin.collage-template");
  assert.equal(scopeOf(line, "-}}"), "punctuation.section.embedded.end.collage-template");
  assert.equal(scopeOf(line, "$i"), "variable.other.collage-template");
  assert.equal(scopeOf(line, ".Posts"), "variable.other.member.collage-template");
  assert.equal(scopeOf(line, ":="), "keyword.operator.assignment.collage-template");
  assert.equal(scopeOf(line, "|"), "keyword.operator.pipe.collage-template");
  assert.equal(scopeOf(`{{pageURL "home"}}`, "home"), "string.quoted.double.collage-template");
});

test("a field named like a function is a field", () => {
  assert.equal(scopeOf(`{{.slot}}`, ".slot"), "variable.other.member.collage-template");
  assert.equal(scopeOf(`{{$t := 1}}`, "$t"), "variable.other.collage-template");
});

test("templates inside attribute values are coloured", () => {
  const line = `<a href="{{pageURL "about"}}">`;
  assert.equal(scopeOf(line, "pageURL"), "support.function.collage.core");
});

test("comments inside actions, and HTML comments left alone", () => {
  assert.equal(scopeOf(`{{/* note */}}`, " note "), "comment.block.collage-template");
  assert.equal(scopeOf(`<!-- {{slot "x"}} -->`, "slot"), undefined);
});

test("text outside actions is untouched", () => {
  assert.equal(scopeOf(`plain slot text`, "plain slot text"), "text.html.basic");
});
