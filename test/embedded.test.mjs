// The HTML inside a Go file: where it is, the HTML document it is part of, and
// the editing an HTML file gets — tags closed, a tag pair renamed, Emmet — run on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { inlineRegions, virtualHTML, regionAt } = require("../out/src/embedded.js");
const { tagCompletion, linkedRanges, emmetCompletions } = require("../out/src/htmlservice.js");

// regions returns the text of each region.
const regions = (go) => inlineRegions(go).map((r) => go.slice(r.start, r.end));

test("a NewInlineFragment's raw string, on one line or across several", () => {
  assert.deepEqual(regions('x := collage.NewInlineFragment("x", `<p>{{.T}}</p>`).Build()'), ["<p>{{.T}}</p>"]);
  assert.deepEqual(regions('collage.NewInlineFragment(\n\t"row",\n\t`\n<tr></tr>`,\n).Build()'), ["\n<tr></tr>"]);
  assert.deepEqual(regions('collage.NewInlineFragment(name("a)b"), `<b>`)'), ["<b>"], "a ) in a string is not the call's end");
});

test("a const or var declared as InlineHTML, the raw string on its line or the next", () => {
  assert.deepEqual(regions("const row collage.InlineHTML = `<p></p>`"), ["<p></p>"]);
  assert.deepEqual(regions("var row InlineHTML =\n\t`<i></i>`"), ["<i></i>"]);
  assert.deepEqual(regions("const (\n\ta collage.InlineHTML = `<a>`\n\tb collage.InlineHTML = `<b>`\n)"), ["<a>", "<b>"]);
});

test("nothing else is HTML", () => {
  assert.deepEqual(regions("q := `<p>not a template</p>`"), []);
  assert.deepEqual(regions('collage.NewFragment("x", "pages/x.html")'), []);
  assert.deepEqual(regions("// collage.NewInlineFragment(\"x\", `<p>`)\nq := `<b>`"), [], "a comment is not a call");
  assert.deepEqual(regions('s := "NewInlineFragment(`<p>`)"'), [], "nor is a string");
  assert.deepEqual(regions("var row collage.InlineHTML = build()\nq := `<p>`"), [], "a value that is not a raw string");
  assert.deepEqual(regions("collage.NewInlineFragment(\"x\", rowHTML)\nq := `<p>`"), [], "a template that is a constant");
});

test("the virtual HTML keeps every offset: only the HTML is left, the rest is blank", () => {
  const go = "package p\n\nconst a collage.InlineHTML = `<p>\n  x</p>`\nvar b = 1\n";
  const html = virtualHTML(go);
  assert.equal(html.length, go.length);
  assert.equal(html.split("\n").length, go.split("\n").length);
  assert.equal(html.slice(go.indexOf("<p>"), go.indexOf("</p>") + 4), "<p>\n  x</p>");
  assert.equal(html.replace(/<p>\n {2}x<\/p>/, "").trim(), "", "nothing of the Go is left");
});

test("regionAt finds the region an offset is in, the backticks excluded", () => {
  const go = "const a collage.InlineHTML = `<p></p>`";
  const open = go.indexOf("`");
  assert.equal(regionAt(inlineRegions(go), open), undefined, "on the opening backtick");
  assert.ok(regionAt(inlineRegions(go), open + 1));
  assert.ok(regionAt(inlineRegions(go), go.length - 1), "just before the closing backtick");
  assert.equal(regionAt(inlineRegions(go), 3), undefined);
});

// The HTML service works on the virtual HTML at an offset of the Go file.
const at = (go, marker) => ({ text: virtualHTML(go.replace(marker, "")), offset: go.indexOf(marker) });

test("a tag is closed when its > is typed, and a void element is not", () => {
  const open = at("const a collage.InlineHTML = `<div class=\"x\">|`", "|");
  assert.equal(tagCompletion(open.text, open.offset, ">"), "$0</div>");
  const input = at("const a collage.InlineHTML = `<input>|`", "|");
  assert.equal(tagCompletion(input.text, input.offset, ">"), undefined);
  const close = at("const a collage.InlineHTML = `<ul><li></|`", "|");
  assert.equal(tagCompletion(close.text, close.offset, "/"), "li>");
});

test("the two names of a tag pair are edited together", () => {
  const go = "const a collage.InlineHTML = `<section>{{.T}}</section>`";
  const text = virtualHTML(go);
  const ranges = linkedRanges(text, go.indexOf("section") + 2);
  assert.deepEqual(ranges?.map((r) => text.slice(r.start, r.end)), ["section", "section"]);
});

test("Emmet expands an abbreviation, as it does in an HTML file", () => {
  const { text, offset } = at("const a collage.InlineHTML = `\nul>li*2|\n`", "|");
  const items = emmetCompletions(text, offset);
  const item = items.find((i) => i.label === "ul>li*2");
  assert.ok(item, `no expansion among ${items.map((i) => i.label)}`);
  assert.match(item.newText, /<ul>\s*<li>\$\{?\d*\}?<\/li>\s*<li>\$\{?\d*\}?<\/li>\s*<\/ul>/);
  assert.equal(text.slice(item.start, item.end), "ul>li*2", "it replaces the abbreviation");
});

test("Emmet stays out of a collage action", () => {
  const { text, offset } = at("const a collage.InlineHTML = `<p>{{pageURL|}}</p>`", "|");
  assert.deepEqual(emmetCompletions(text, offset).map((i) => i.label), []);
});

// VS Code's Emmet offers nothing where an abbreviation cannot be: in a script, a
// style, a tag, a comment. Offered there, Enter would turn `pencil.hidden` into
// an element.
test("Emmet stays out of a script, a style, a tag and a comment", () => {
  for (const go of [
    "const a collage.InlineHTML = `<script>\n  pencil.hidden|\n</script>`",
    "const a collage.InlineHTML = `<style>\n  .a|\n</style>`",
    "const a collage.InlineHTML = `<div class=\"btn-primary|\"></div>`",
    "const a collage.InlineHTML = `<div data-x|></div>`",
    "const a collage.InlineHTML = `<!-- ul>li|\n-->`",
  ]) {
    const { text, offset } = at(go, "|");
    assert.deepEqual(emmetCompletions(text, offset).map((i) => i.label), [], go);
  }
  // Between elements it is offered still.
  const { text, offset } = at("const a collage.InlineHTML = `<main>\n  section.card|\n</main>`", "|");
  assert.ok(emmetCompletions(text, offset).some((i) => i.label === "section.card"));
});
