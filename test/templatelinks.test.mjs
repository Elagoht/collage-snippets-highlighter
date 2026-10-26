// NewFragment's template path in Go: where it is, and the file it names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { templatePaths, templatePathAt, resolveTemplate } = require("../out/src/templatelinks.js");

// paths returns each path's value and the text its offsets cover.
const paths = (go) => templatePaths(go).map((p) => [p.value, go.slice(p.start, p.end)]);

test("NewFragment's second argument, qualified or not, on one line or across several", () => {
  assert.deepEqual(paths('l := collage.NewFragment("layout", "layouts/master.html")'), [["layouts/master.html", "layouts/master.html"]]);
  assert.deepEqual(paths('NewFragment("home", "pages/home.html").Build()'), [["pages/home.html", "pages/home.html"]]);
  assert.deepEqual(paths('collage.NewFragment(\n\t"post",\n\t"pages/post.html",\n).Build()'), [["pages/post.html", "pages/post.html"]]);
  assert.deepEqual(paths("collage.NewFragment(\"x\", `pages/x.html`)"), [["pages/x.html", "pages/x.html"]], "a raw string");
  assert.deepEqual(paths('collage.NewFragment(name("a", "b"), "pages/x.html")'), [["pages/x.html", "pages/x.html"]], "a comma in a nested call");
  assert.deepEqual(paths('a := collage.NewFragment("a", "a.html")\nb := collage.NewFragment("b", "b.html")').map((p) => p[0]), ["a.html", "b.html"]);
});

test("nothing else is a template path", () => {
  assert.deepEqual(paths('collage.NewFragment("x", tmpl)'), [], "a variable");
  assert.deepEqual(paths('collage.NewFragment("x", "pages/" + "x.html")'), [], "a concatenation");
  assert.deepEqual(paths('collage.NewInlineFragment("x", "<p></p>")'), [], "an inline template");
  assert.deepEqual(paths('collage.NewFragment("pages/x.html")'), [], "the first argument");
  assert.deepEqual(paths('// collage.NewFragment("x", "pages/x.html")'), [], "a comment");
  assert.deepEqual(paths('s := `collage.NewFragment("x", "pages/x.html")`'), [], "a string");
  assert.deepEqual(paths('collage.NewFragment("x", "pages/x.ht\n'), [], "a literal still being typed");
  assert.deepEqual(paths('collage.NewFragment("x", "")'), [], "an empty path");
});

test("templatePathAt finds the path an offset is in, either quote included", () => {
  const go = 'collage.NewFragment("layout", "layouts/master.html")';
  const open = go.indexOf('"layouts');
  assert.equal(templatePathAt(go, open)?.value, "layouts/master.html", "on the opening quote");
  assert.equal(templatePathAt(go, open + 8)?.value, "layouts/master.html");
  assert.equal(templatePathAt(go, go.lastIndexOf('"'))?.value, "layouts/master.html", "on the closing quote");
  assert.equal(templatePathAt(go, go.indexOf("layout")), undefined, "the fragment's name");
});

test("a path resolves to its file under the template directory, when there is one", async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "collage-links-")));
  mkdirSync(join(dir, "layouts"));
  writeFileSync(join(dir, "layouts/master.html"), "");
  writeFileSync(join(dir, "outside.html"), "");
  assert.equal(await resolveTemplate(dir, "layouts/master.html", ".html"), join(dir, "layouts/master.html"));
  assert.equal(await resolveTemplate(dir, "layouts/master", ".html"), join(dir, "layouts/master.html"), "the extension added");
  assert.equal(await resolveTemplate(dir, "layouts/missing.html", ".html"), undefined);
  assert.equal(await resolveTemplate(dir, "layouts", ".html"), undefined, "a directory");
  assert.equal(await resolveTemplate(join(dir, "layouts"), "../outside.html", ".html"), undefined, "out of the template directory");
});

test("a package alias, a dot import and a backtick path are paths too", () => {
  assert.deepEqual(paths('c.NewFragment("layout", "layouts/master.html")').map((p) => p[0]), ["layouts/master.html"]);
  assert.deepEqual(paths('NewFragment("layout", "layouts/master.html")').map((p) => p[0]), ["layouts/master.html"]);
  assert.deepEqual(paths("collage.NewFragment(`layout`, `layouts/master.html`)").map((p) => p[0]), ["layouts/master.html"]);
});

test("what collage add writes: a fragment's and a layout's --file", () => {
  // collage add page blog/post --file, collage add layout auth --file
  const page = 'func Post() *collage.Fragment {\n\treturn collage.NewFragment("blogPost", "pages/blog/post.html").\n\t\tWithData(postData()).\n\t\tBuild()\n}\n';
  const layout = 'func Auth() *collage.Fragment {\n\treturn collage.NewFragment("authLayout", "layouts/auth.html").\n\t\tWithGuard(guards.Auth).\n\t\tBuild()\n}\n';
  assert.deepEqual(paths(page), [["pages/blog/post.html", "pages/blog/post.html"]]);
  assert.deepEqual(paths(layout), [["layouts/auth.html", "layouts/auth.html"]]);
});

test("a path held in a constant or variable of the file: its literal is the link", () => {
  const go = `const masterTemplate = "layouts/master.html"

var (
	cardTemplate string = "parts/card.html"
	unused = "parts/unused.html"
)

func Master() *collage.Fragment {
	path := "pages/home.html"
	_ = collage.NewFragment("home", path)
	_ = collage.NewFragment("card", cardTemplate)
	return collage.NewFragment("layout", masterTemplate).Build()
}`;
  assert.deepEqual(paths(go).map((p) => p[0]).sort(), ["layouts/master.html", "pages/home.html", "parts/card.html"]);
  assert.equal(templatePathAt(go, go.indexOf("layouts/master.html") + 3)?.value, "layouts/master.html");
  assert.deepEqual(paths('const t = "a" + ".html"\nx := collage.NewFragment("x", t)'), [], "a concatenation");
});

test("findTemplate: under the template directory, or wherever under the project it is", async () => {
  const { findTemplate } = require("../out/src/templatelinks.js");
  const root = realpathSync(mkdtempSync(join(tmpdir(), "collage-find-")));
  mkdirSync(join(root, "web/views/layouts"), { recursive: true });
  writeFileSync(join(root, "web/views/layouts/master.html"), "");
  mkdirSync(join(root, "node_modules/x/layouts"), { recursive: true });
  writeFileSync(join(root, "node_modules/x/layouts/master.html"), "");
  // Config.Template.Root is "web/views", and no inspection has said so.
  assert.deepEqual(await findTemplate(root, join(root, "templates"), "layouts/master.html", ".html"), [join(root, "web/views/layouts/master.html")]);
  assert.deepEqual(await findTemplate(root, join(root, "templates"), "layouts/master", ".html"), [join(root, "web/views/layouts/master.html")], "the extension added");
  assert.deepEqual(await findTemplate(root, join(root, "templates"), "layouts/missing.html", ".html"), []);
  // Once an inspection has said where the templates are, a copy elsewhere is not the one.
  assert.deepEqual(await findTemplate(root, join(root, "templates"), "layouts/master.html", ".html", false), [], "no search when the directory is known");
  mkdirSync(join(root, "templates/layouts"), { recursive: true });
  writeFileSync(join(root, "templates/layouts/master.html"), "");
  assert.deepEqual(await findTemplate(root, join(root, "templates"), "layouts/master.html", ".html"), [join(root, "templates/layouts/master.html")], "the template directory first, alone");
});
