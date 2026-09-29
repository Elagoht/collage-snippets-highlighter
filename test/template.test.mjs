// The reading of template actions completion and diagnostics rely on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { allCalls, stringArgAt } = require("../out/src/template.js");
const { namesFor, unknownName } = require("../out/src/names.js");

// at puts the cursor where ‸ is, and returns the text without it and the offset.
const at = (s) => [s.replace("‸", ""), s.indexOf("‸")];

test("the argument the cursor is in", () => {
  let [text, off] = at(`<a href="{{pageURL "po‸"}}">`);
  let p = stringArgAt(text, off);
  assert.equal(p.call.name, "pageURL");
  assert.equal(p.index, 0);
  assert.equal(text.slice(p.contentStart, p.contentEnd), "po");

  [text, off] = at(`{{fragmentURL "post" "‸`); // unterminated, as while typing
  p = stringArgAt(text, off);
  assert.equal(p.call.name, "fragmentURL");
  assert.equal(p.index, 1);

  [text, off] = at(`{{if eq .A "x"}}{{slot "a‸"}}{{end}}`);
  assert.equal(stringArgAt(text, off).call.name, "slot");

  [text, off] = at(`{{ .Title | printf "%s‸" }}`);
  assert.equal(stringArgAt(text, off).call.name, "printf");

  [text, off] = at(`{{with $u := pageURL "ho‸"}}`);
  assert.equal(stringArgAt(text, off).call.name, "pageURL");

  [text, off] = at(`{{default (pageURL "x‸") .URL}}`);
  assert.equal(stringArgAt(text, off).call.name, "pageURL");

  [text, off] = at(`<p>"not in an action‸"</p>`);
  assert.equal(stringArgAt(text, off), undefined);
});

test("every call in a document, with literal arguments", () => {
  const calls = allCalls(`{{slot "content"}} x {{pageURL "post" "slug" .Slug}} {{/* slot "nope" */}} {{- asset "/a.css" -}}`);
  assert.deepEqual(calls.map((c) => [c.name, c.args.map((a) => (a.isString ? a.value : "·"))]), [
    ["slot", ["content"]],
    ["pageURL", ["post", "slug", "·"]],
    ["asset", ["/a.css"]],
  ]);
});

const inspection = {
  version: 1, templateRoot: "templates", templateExtension: ".html", defaultLocale: "en", locales: ["en", "tr"],
  pages: [
    { name: "post", paths: { en: "/blog/{slug}" }, params: ["slug"], fragmentPaths: [{ fragment: "comments", locale: "en", pattern: "/blog/{slug}/comments", params: ["slug"] }] },
    { name: "home", paths: { en: "/" } },
  ],
  fragments: [{ name: "post", template: "pages/post.html", slots: ["aside", "comments"] }, { name: "home", template: "pages/home.html" }],
  documents: [{ name: "feed", paths: { "": "/feed.xml" }, contentType: "application/xml" }],
  actions: [{ name: "logout", paths: { en: "/logout" }, methods: ["POST"] }, { name: "vote", paths: { en: "/blog/{slug}/vote", tr: "/yazi/{slug}/oy" }, methods: ["POST"] }],
  templateFuncs: [], plugins: [],
  mounts: [{ prefix: "/static/", files: ["/static/app.css", "/static/app.js"] }],
};
const call = (src) => allCalls(src)[0];
const labels = (r) => r?.names.map((n) => n.label);

test("names valid in each position", () => {
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{pageURL ""}}`), 0)), ["post", "home", "feed"]);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{pageURL "post" ""}}`), 1)), ["slug"]);
  assert.equal(namesFor(inspection, undefined, call(`{{pageURL "post" "slug" ""}}`), 2), undefined);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{pageURLIn "" ""}}`), 0)), ["en", "tr"]);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{fragmentURL ""}}`), 0)), ["post"]);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{fragmentURL "post" ""}}`), 1)), ["comments"]);
  assert.deepEqual(labels(namesFor(inspection, "pages/post.html", call(`{{slot ""}}`), 0)), ["aside", "comments"]);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{stylesheet ""}}`), 0)), ["/static/app.css"]);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{actionURL ""}}`), 0)), ["logout", "vote"]);
  assert.deepEqual(labels(namesFor(inspection, undefined, call(`{{actionURL "vote" ""}}`), 1)), ["slug"]);
  assert.equal(namesFor(inspection, undefined, call(`{{actionURL "vote" "slug" ""}}`), 2), undefined);
});

test("unknown names, only where the set is certain", () => {
  assert.match(unknownName(inspection, undefined, call(`{{pageURL "posts"}}`), 0), /No page or document named "posts"/);
  assert.equal(unknownName(inspection, undefined, call(`{{pageURL "feed"}}`), 0), undefined);
  // A slot a template calls is a slot: collage renders one nothing fills as
  // empty. Never flagged, only completed.
  assert.equal(unknownName(inspection, "pages/post.html", call(`{{slot "sidebar"}}`), 0), undefined);
  assert.match(unknownName(inspection, undefined, call(`{{asset "/static/nope.css"}}`), 0), /No mounted file/);
  assert.equal(unknownName(inspection, undefined, call(`{{pageURL "post" "slug" "x"}}`), 2), undefined);
  assert.match(unknownName(inspection, undefined, call(`{{actionURL "logut"}}`), 0), /No action named "logut"/);
});
