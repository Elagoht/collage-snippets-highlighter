// WithSlotFragment("…"): the slot names of the parent fragment's template.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { slotBindings, slotBindingAt, templateSlots } = require("../out/src/goslots.js");

const at = (s) => [s.replace("‸", ""), s.indexOf("‸")];

test("the parent of a binding: the builder chain read back to its constructor", () => {
  const go = `func Post() *collage.Fragment {
	return collage.NewFragment("post", "pages/post.html").
		WithData(collage.Load(loadPost)).
		WithSlotFragment("comments", CommentList()).
		WithSlotResolver("cards", func(rc *collage.RenderContext) ([]*collage.Fragment, error) { return nil, nil }).
		Build()
}`;
  const b = slotBindings(go);
  assert.deepEqual(b.map((x) => [x.method, x.value, x.parent]), [
    ["WithSlotFragment", "comments", { name: "post", template: "pages/post.html" }],
    ["WithSlotResolver", "cards", { name: "post", template: "pages/post.html" }],
  ]);
  assert.equal(go.slice(b[0].start, b[0].end), '"comments"');
});

test("an inline parent, its template a raw string or a constant", () => {
  const go = [
    'a := collage.NewInlineFragment("box", `<div>{{slot "body"}}</div>`).WithSlotFragment("body", x)',
    "const shell collage.InlineHTML = `{{slot \"main\"}}`",
    'b := collage.NewInlineFragment("shell", shell).WithSlotFragment("main", y)',
  ].join("\n");
  const [one, two] = slotBindings(go);
  assert.deepEqual(templateSlots(one.parent.inline).names, ["body"]);
  assert.deepEqual(templateSlots(two.parent.inline).names, ["main"]);
});

test("a builder held in a variable", () => {
  const go = `b := collage.NewFragment("post", "pages/post.html")
	b.WithSlotFragment("aside", x)
	other.WithSlotFragment("x", y)`;
  const [one, two] = slotBindings(go);
  assert.deepEqual(one.parent, { name: "post", template: "pages/post.html" });
  assert.equal(two.parent, undefined, "a receiver not built here: unknown");
});

test("the cursor in the slot name, while it is typed", () => {
  let [go, off] = at('collage.NewFragment("p", "p.html").WithSlotFragment("co‸');
  let b = slotBindingAt(go, off);
  assert.equal(b.closed, false);
  assert.equal(go.slice(b.start + 1, b.end), "co");
  assert.equal(b.parent.template, "p.html");
  [go, off] = at('collage.NewFragment("p", "p.html").WithSlotFragment("co‸mments", c).Build()');
  b = slotBindingAt(go, off);
  assert.equal(b.closed, true);
  assert.equal(b.value, "comments");
  [go, off] = at('collage.NewFragment("p", "p.html").WithSlotFragment("comments", c‸)');
  assert.equal(slotBindingAt(go, off), undefined);
});

test("the slots a template calls, and whether that is all of them", () => {
  assert.deepEqual(templateSlots(`{{slot "a"}}<p>{{if .X}}{{slot "b"}}{{end}}{{slot "a"}}`), { names: ["a", "b"], complete: true });
  assert.deepEqual(templateSlots(`{{slot .Name}}{{slot "a"}}`), { names: ["a"], complete: false }, "a slot by a computed name");
  assert.deepEqual(templateSlots(`{{template "partials/aside.html" .}}{{slot "a"}}`), { names: ["a"], complete: false }, "an include collage follows");
  assert.deepEqual(templateSlots(`<p>nothing</p>`), { names: [], complete: true });
});

test("a variable is followed only within its function, and a field never", () => {
  const go = `func a() {
	b := collage.NewFragment("post", "pages/post.html")
	_ = b
}

func c(t *T) {
	b.WithSlotFragment("aside", x)
	t.frag.WithSlotFragment("aside", x)
	s.b.WithSlotFragment("aside", x)
}`;
  assert.deepEqual(slotBindings(go).map((b) => b.parent), [undefined, undefined, undefined]);
});

test("a parent known only by name: its template only when the name has one", async () => {
  const { templateByName } = require("../out/src/goslots.js");
  const inspection = { fragments: [
    { name: "post", template: "pages/post.html" }, { name: "post", template: "pages/post.html" },
    { name: "card", template: "a/card.html" }, { name: "card", template: "b/card.html" },
    { name: "row", template: "", inline: true },
  ] };
  assert.equal(templateByName(inspection, "post"), "pages/post.html");
  assert.equal(templateByName(inspection, "card"), undefined, "two fragments named card, two templates");
  assert.equal(templateByName(inspection, "row"), undefined);
  assert.equal(templateByName(inspection, "nope"), undefined);
});
