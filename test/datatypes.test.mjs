// Completion and checking of a template's data, against what collage-inspect
// printed for a real application (test/fixtures/inspect.json, collage v0.51.0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { parseType, resolve, rangeOf, dataOf, fragmentsOfTemplate, fragmentsNamed, walk, completeAt, embeddedFields } = require("../out/src/datatypes.js");
const { inlineTemplates, inlineUses } = require("../out/src/embedded.js");

// The fixture is `go run . collage-inspect` of a scaffolded demo with a blog
// package added: Post{Base; Attrs map[string]any; Title; Author *User;
// Comments []Comment; Tags map[string]Meta; Related []*Post; Extra any;
// Grid [2][]string}, methods URL, Excerpt(n) on *Post, WordCount(a, b);
// Posts []Post with Len; fragments post (blog.Post), post-card (blog.Post) and
// user-card (*blog.User) on partials/card.html, post-list (blog.Posts), the
// inline comment-list ([]blog.Comment), layout (nil).
const inspection = JSON.parse(readFileSync(new URL("./fixtures/inspect.json", import.meta.url), "utf8"));
const types = inspection.types;

const dataOfTemplate = (name) => dataOf(fragmentsOfTemplate(inspection, name), types);
const post = dataOfTemplate("pages/post.html");

// at puts the cursor where ‸ is, and returns the text without it and the offset.
const at = (s) => [s.replace("‸", ""), s.indexOf("‸")];
const names = (c) => c?.items.map((i) => i.name).sort();
const complete = (src, data = post, opts) => {
  const [text, off] = at(src);
  return completeAt(text, 0, text.length, off, data, types, opts);
};
const findings = (text, data = post, opts) => walk(text, 0, text.length, data, types, opts).findings.map((f) => [text.slice(f.start, f.end), f.message]);

test("type strings, as reflect writes them", () => {
  assert.deepEqual(parseType("blog.Post", types), { kind: "named", text: "blog.Post" });
  const p = parseType("*blog.User", types);
  assert.equal(p.kind, "pointer");
  assert.equal(p.elem.text, "blog.User");
  const s = parseType("[]*blog.Post", types);
  assert.equal(s.kind, "slice");
  assert.equal(s.elem.kind, "pointer");
  const m = parseType("map[string]blog.Meta", types);
  assert.equal(m.kind, "map");
  assert.equal(m.key.text, "string");
  assert.equal(m.elem.text, "blog.Meta");
  const nested = parseType("map[[2]int][]map[string]interface {}", types);
  assert.equal(nested.key.text, "[2]int");
  assert.equal(nested.elem.elem.elem.kind, "unknown");
  assert.equal(parseType("[2][]string", types).elem.elem.kind, "basic");
  assert.equal(parseType("interface {}", types).kind, "unknown");
  assert.equal(parseType("func(int) string", types).kind, "unknown");
  assert.equal(parseType("<-chan blog.Comment", types).elem.text, "blog.Comment");
  assert.equal(parseType("time.Time", types).kind, "opaque", "the standard library is not expanded");
  assert.equal(parseType("template.HTML", types).kind, "opaque");
});

test("chains: fields, pointers followed, methods, map keys", () => {
  assert.deepEqual(resolve(post, ["Author", "Name"], types).value.types.map((t) => t.text), ["string"]);
  assert.deepEqual(resolve(post, ["URL"], types).value.types.map((t) => t.text), ["string"]);
  assert.deepEqual(resolve(post, ["Tags", "go", "Score"], types).value.types.map((t) => t.text), ["int"], "a key of map[string]Meta is a Meta");
  assert.equal(resolve(post, ["Attrs", "x", "Y"], types).missing, undefined, "map[string]any: unknown below");
  assert.equal(resolve(post, ["Extra", "Anything"], types).missing, undefined, "an interface is unknown");
  assert.equal(resolve(post, ["Author", "Bio", "X"], types).missing, undefined, "an opaque type is unknown");
  const miss = resolve(post, ["Author", "Nmae"], types).missing;
  assert.deepEqual([miss.index, miss.name, miss.on, miss.suggestion], [1, "Nmae", ["*blog.User"], "Name"]);
});

test("range gives the element, and the index or key", () => {
  const comments = resolve(post, ["Comments"], types).value;
  const { key, elem } = rangeOf(comments, types);
  assert.deepEqual([key.types[0].text, elem.types[0].text], ["int", "blog.Comment"]);
  const tags = rangeOf(resolve(post, ["Tags"], types).value, types);
  assert.deepEqual([tags.key.types[0].text, tags.elem.types[0].text], ["string", "blog.Meta"]);
  const related = rangeOf(resolve(post, ["Related"], types).value, types);
  assert.equal(related.elem.types[0].text, "*blog.Post");
  // A named container's element is not in the table.
  const list = rangeOf(dataOfTemplate("partials/list.html"), types);
  assert.equal(list.elem.unknown, true);
});

test("completing {{. and chains", () => {
  assert.deepEqual(names(complete("<h1>{{.‸")), ["Attrs", "Author", "Comments", "Excerpt", "Extra", "Grid", "ID", "Related", "Slug", "Tags", "Title", "URL", "WordCount"]);
  assert.deepEqual(names(complete("{{.Author.‸}}")), ["Bio", "Email", "Initials", "Name"]);
  assert.deepEqual(names(complete("{{ .Tags.go.‸ }}")), ["Extra", "Score"]);
  assert.deepEqual(names(complete("{{.Ti‸")), names(complete("{{.‸")), "the word typed so far is replaced, not narrowed here");
  const c = complete("{{.Ti‸tle}}");
  assert.equal(c.end - c.start, 5, "the whole word is replaced");
  const m = complete("{{.‸").items.find((i) => i.name === "Excerpt");
  assert.deepEqual([m.args, m.type], [1, "string"]);
  assert.equal(complete("{{(.Author).‸"), undefined, "a field of a parenthesised value is not known");
  assert.equal(complete("{{printf 1.‸"), undefined, "a number is not a chain");
  assert.deepEqual(names(complete("{{.Extra.‸")), [], "nothing to offer on an interface");
});

test("range, with, else and variables narrow the dot", () => {
  assert.deepEqual(names(complete("{{range .Comments}}{{.‸")), ["At", "Author", "Body"]);
  assert.deepEqual(names(complete("{{range .Comments}}{{.Author.‸")), ["Bio", "Email", "Initials", "Name"]);
  assert.deepEqual(names(complete("{{range $i, $c := .Comments}}{{$c.‸")), ["At", "Author", "Body"]);
  assert.deepEqual(names(complete("{{range $c := .Related}}{{$c.Author.‸")), ["Bio", "Email", "Initials", "Name"]);
  assert.deepEqual(names(complete("{{range $k, $m := .Tags}}{{$m.‸")), ["Extra", "Score"]);
  assert.deepEqual(names(complete("{{with .Author}}{{.‸")), ["Bio", "Email", "Initials", "Name"]);
  assert.ok(names(complete("{{with .Author}}{{else}}{{.‸")).includes("Title"), "else goes back to the outer dot");
  assert.ok(names(complete("{{range .Comments}}{{end}}{{.‸")).includes("Title"), "end too");
  assert.ok(names(complete("{{range .Comments}}{{$.‸")).includes("Title"), "$ is the data");
  assert.deepEqual(names(complete("{{$u := .Author}}{{if .Title}}{{$u.‸")), ["Bio", "Email", "Initials", "Name"]);
  assert.deepEqual(names(complete("{{with $a := .Author}}{{$a.‸")), ["Bio", "Email", "Initials", "Name"]);
  assert.deepEqual(names(complete("{{if .Title}}{{else with .Author}}{{.‸")), ["Bio", "Email", "Initials", "Name"]);
  assert.deepEqual(names(complete(`{{range .Comments}}{{/* {{end}} */}}{{.‸`)), ["At", "Author", "Body"], "a comment is not an action");
  assert.deepEqual(names(complete("{{define \"x\"}}{{.‸")), [], "a define's dot is whoever invokes it");
  assert.ok(names(complete("{{define \"x\"}}{{.A}}{{end}}{{.‸")).includes("Title"));
  const vars = complete("{{$u := .Author}}{{range $i, $c := .Comments}}{{$‸");
  assert.deepEqual(vars.items.map((v) => v.name).sort(), ["$", "$c", "$i", "$u"]);
  assert.deepEqual(vars.items.find((v) => v.name === "$u").value.types.map((t) => t.text), ["*blog.User"]);
});

test("a template several fragments render: the union, flagged only where none has it", () => {
  const card = dataOfTemplate("partials/card.html");
  assert.deepEqual(card.types.map((t) => t.text).sort(), ["*blog.User", "blog.Post"]);
  const c = complete("{{.‸", card);
  assert.ok(names(c).includes("Title") && names(c).includes("Name"));
  const title = c.items.find((i) => i.name === "Title");
  assert.deepEqual([title.on, title.of], [["blog.Post"], 2], "said to be only some types'");
  assert.deepEqual(findings("{{.Title}} {{.Name}} {{.Nope}}", card), [["Nope", "none of blog.Post, *blog.User has a field or method Nope"]]);
});

test("names no type has are reported, and nothing else", () => {
  const text = [
    "{{.Titel}}",
    "{{.Author.Nmae}}",
    "{{range .Comments}}{{.Body}}{{.Bdy}}{{end}}",
    "{{range $i, $c := .Comments}}{{$c.Author.Email}}{{$c.Autor}}{{end}}",
    "{{with .Author}}{{.Initials}}{{end}}",
    "{{.Tags.anykey.Score}}{{.Attrs.x.y.z}}{{.Extra.Whatever}}{{.Author.Bio.X}}",
    "{{(.Author).Whatever}}{{printf \"%s\" .Title | len}}",
    "{{range flashes}}{{.Text}}{{end}}",
    "{{$.Titel}}",
    "{{define \"x\"}}{{.Whatever}}{{end}}{{block \"y\" .}}{{.Whatever}}{{end}}",
    "{{/* {{.Commented}} */}}",
  ].join("\n");
  assert.deepEqual(findings(text), [
    ["Titel", "type blog.Post has no field or method Titel (did you mean Title?)"],
    ["Nmae", "type *blog.User has no field or method Nmae (did you mean Name?)"],
    ["Bdy", "type blog.Comment has no field or method Bdy (did you mean Body?)"],
    ["Autor", "type blog.Comment has no field or method Autor (did you mean Author?)"],
    ["Titel", "type blog.Post has no field or method Titel (did you mean Title?)"],
  ]);
});

test("silent where the data is not known", () => {
  const all = "{{.Anything}}{{.A.B}}{{range .X}}{{.Y}}{{end}}";
  // A fragment with no data, a type null, a type the table lacks, WithoutTypeCheck.
  assert.deepEqual(findings(all, dataOfTemplate("layouts/default.html")), [], "nil data");
  assert.deepEqual(findings(all, dataOf([{ name: "x", template: "x.html", dataType: null }], types)), [], "unknown type");
  assert.deepEqual(findings(all, dataOf([{ name: "x", template: "x.html", dataType: "other.Thing" }], types)), [], "a type the table lacks");
  assert.deepEqual(findings(all, dataOf([{ name: "x", template: "x.html", dataType: "interface {}" }], types)), [], "an interface");
  assert.deepEqual(findings(all, dataOf([{ name: "x", template: "x.html", dataType: "blog.Post", typeCheck: false }], types)), [], "WithoutTypeCheck");
  assert.deepEqual(findings(all, dataOf([{ name: "x", template: "x.html", dataType: "blog.Post" }, { name: "y", template: "x.html", dataType: null }], types)), [], "one of several unknown");
  assert.deepEqual(findings(all, dataOfTemplate("nowhere.html")), [], "a template no fragment renders");
  // The named container: ranged over, its element is unknown; its methods complete.
  const list = dataOfTemplate("partials/list.html");
  assert.deepEqual(findings("{{range .}}{{.Whatever}}{{end}}{{.Len}}", list), []);
  assert.deepEqual(names(complete("{{.‸", list)), ["Len"]);
  // A function's result is unknown.
  assert.deepEqual(findings("{{with index .Comments 0}}{{.Nope}}{{end}}{{$x := len .Comments}}{{$x.Nope}}"), []);
});

test("an embedded field is not reported: the table lists only what it promotes", () => {
  assert.deepEqual(findings("{{.Base.ID}}{{.ID}}", post, { embedded: new Set(["Base"]) }), []);
  assert.deepEqual(embeddedFields("type Post struct {\n\tBase\n\t*auth.User `json:\"u\"`\n\tTitle string\n\tbase\n}\ntype X struct{ Inner; N int }"), ["Base", "User", "Inner"]);
});

test("inline templates: by the fragment name, or the constant passed with one", () => {
  const go = [
    'collage.NewInlineFragment("comment-list", `<ul>{{range .}}<li>{{.Body}}</li>{{end}}</ul>`)',
    "const clockBlock collage.InlineHTML = `{{.Uptime}}`",
    'collage.NewInlineFragment("demo-clock", clockBlock)',
  ].join("\n");
  const regions = inlineTemplates(go);
  assert.deepEqual(regions.map((r) => [r.fragment, r.ident]), [["comment-list", undefined], [undefined, "clockBlock"]]);
  assert.deepEqual([...inlineUses(go)], [["clockBlock", ["demo-clock"]]]);
  const list = dataOf(fragmentsNamed(inspection, ["comment-list"]), types);
  assert.deepEqual(list.types.map((t) => t.text), ["[]blog.Comment"]);
  const r = regions[0];
  const offset = go.indexOf(".Body") + 1;
  assert.deepEqual(names(completeAt(go, r.start, r.end, offset, list, types)), ["At", "Author", "Body"]);
  const clock = dataOf(fragmentsNamed(inspection, ["demo-clock"]), types);
  const bad = go.replace("{{.Uptime}}", "{{.Uptme}}");
  const r2 = inlineTemplates(bad)[1];
  assert.deepEqual(walk(bad, r2.start, r2.end, clock, types).findings.map((f) => f.message), ["type fragments.clockView has no field or method Uptme (did you mean Uptime?)"]);
});

test("a template file maps to its fragments by its path under the template root", () => {
  assert.deepEqual(fragmentsOfTemplate(inspection, "pages/post.html").map((f) => f.name), ["post"]);
  assert.deepEqual(fragmentsOfTemplate(inspection, "partials/card.html").map((f) => f.name).sort(), ["post-card", "user-card"]);
  // A template root the inspection does not name: matched by the path's end.
  assert.deepEqual(fragmentsOfTemplate(inspection, "templates/pages/post.html", "templates/pages/post.html").map((f) => f.name), ["post"]);
  assert.deepEqual(fragmentsOfTemplate(inspection, undefined, "static/x.html"), []);
});
