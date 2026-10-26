// Page, document and action names in Go: the string arguments of collage's and
// its plugins' functions that name one, completed and checked as {{pageURL}}'s are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { goNameArgs, goNameArgAt, goNamesFor, unknownGoName, declaredNames } = require("../out/src/gonames.js");

const inspection = {
  version: 1, templateRoot: "templates", templateExtension: ".html", defaultLocale: "en", locales: ["en", "tr"],
  pages: [
    { name: "post", paths: { en: "/blog/{slug}" }, params: ["slug"], fragmentPaths: [{ fragment: "comments", locale: "en", pattern: "/blog/{slug}/comments", params: ["slug"] }] },
    { name: "login", paths: { en: "/login" } },
  ],
  fragments: [],
  documents: [{ name: "feed", paths: { "": "/feed.xml" }, contentType: "application/xml" }],
  actions: [{ name: "logout", paths: { en: "/logout" }, methods: ["POST"] }],
  templateFuncs: [], plugins: [], mounts: [],
};

const at = (s) => [s.replace("‸", ""), s.indexOf("‸")];
// kinds lists each name argument as [call, kind, value].
const kinds = (go) => goNameArgs(go).map((a) => [a.call, a.kind, a.value]);
const labels = (r) => r?.names.map((n) => n.label);

test("collage's functions that take a page, document or action name", () => {
  const go = `package actions

import "github.com/Elagoht/collage/pkg/collage"

func a(ctx context.Context, rc *collage.RenderContext, app *collage.App) {
	collage.SeeOtherPage(rc, "post", map[string]string{"slug": s})
	collage.GuardSeeOtherPage(ctx, "login", nil)
	collage.URL(ctx, "feed", nil)
	rc.URL("post", nil)
	app.URL("post", "tr", nil)
	rc.ActionURL("logout", nil)
	app.ActionURL("logout", "en", nil)
	app.FragmentURL("post", "comments", "en", nil)
	app.Page("login")
	app.PageURLs(ctx, "post")
}`;
  assert.deepEqual(kinds(go), [
    ["SeeOtherPage", "route", "post"],
    ["GuardSeeOtherPage", "route", "login"],
    ["URL", "route", "feed"],
    ["URL", "route", "post"],
    ["URL", "route", "post"],
    ["URL", "locale", "tr"],
    ["ActionURL", "action", "logout"],
    ["ActionURL", "action", "logout"],
    ["ActionURL", "locale", "en"],
    ["FragmentURL", "fragmentPage", "post"],
    ["FragmentURL", "fragment", "comments"],
    ["FragmentURL", "locale", "en"],
    ["Page", "page", "login"],
    ["PageURLs", "page", "post"],
  ]);
});

test("the plugins' functions that take one", () => {
  const go = `session.RequireUserPage("login")
session.RequirePage(session.UserKey, "login")
session.RequireGuestPage("post")
paginate.PathNamed(rc, "post", "post")`;
  assert.deepEqual(kinds(go), [
    ["RequireUserPage", "route", "login"],
    ["RequirePage", "route", "login"],
    ["RequireGuestPage", "route", "post"],
    ["PathNamed", "route", "post"],
    ["PathNamed", "route", "post"],
  ]);
});

test("collage under another name: collage.URL's name is its second argument, a method's its first", () => {
  const aliased = `import c "github.com/Elagoht/collage/pkg/collage"
c.URL(ctx, "post", nil)
c.SeeOtherPage(rc, "post", nil)`;
  assert.deepEqual(kinds(aliased), [["URL", "route", "post"], ["SeeOtherPage", "route", "post"]]);
  const dotted = `import . "github.com/Elagoht/collage/pkg/collage"
URL(ctx, "post", nil)
SeeOtherPage(rc, "post", nil)`;
  assert.deepEqual(kinds(dotted), [["URL", "route", "post"], ["SeeOtherPage", "route", "post"]]);
  // Without collage dot-imported, a bare URL is the file's own function.
  assert.deepEqual(kinds(`URL(ctx, "post", nil)`), []);
});

test("nothing else is a name", () => {
  assert.deepEqual(kinds(`collage.SeeOtherPage(rc, name, nil)`), [], "a variable");
  assert.deepEqual(kinds(`collage.SeeOtherPage(rc, "po" + "st", nil)`), [], "a concatenation");
  assert.deepEqual(kinds(`collage.SeeOther("/login")`), [], "a path, not a name");
  assert.deepEqual(kinds(`session.RequireUser("/login")`), [], "a path, not a name");
  assert.deepEqual(kinds(`// collage.SeeOtherPage(rc, "post", nil)`), [], "a comment");
  assert.deepEqual(kinds("s := `collage.SeeOtherPage(rc, \"post\", nil)`"), [], "a string");
  assert.deepEqual(kinds(`collage.NewPage("post")`), [], "a declaration");
  assert.deepEqual(kinds(`rc.URL(name, nil)`), []);
});

test("the cursor in a name, while it is typed", () => {
  let [go, off] = at('return collage.SeeOtherPage(rc, "po‸\n}');
  let a = goNameArgAt(go, off);
  assert.equal(a.kind, "route");
  assert.equal(a.closed, false);
  assert.equal(go.slice(a.start + 1, a.end), "po");
  [go, off] = at('return collage.SeeOtherPage(rc, "‸");');
  a = goNameArgAt(go, off);
  assert.equal(a.closed, true);
  assert.equal(a.value, "");
  [go, off] = at('WithGuard(session.RequireUserPage("lo‸gin")).');
  assert.equal(goNameArgAt(go, off).value, "login");
  [go, off] = at('collage.SeeOtherPage(rc‸, "post", nil)');
  assert.equal(goNameArgAt(go, off), undefined);
  [go, off] = at('collage.SeeOtherPage(rc, "post"‸, nil)');
  assert.equal(goNameArgAt(go, off), undefined, "after the closing quote");
});

test("the names offered in each position", () => {
  const arg = (go) => goNameArgs(go)[0];
  assert.deepEqual(labels(goNamesFor(inspection, arg(`collage.SeeOtherPage(rc, "", nil)`))), ["post", "login", "feed"]);
  assert.deepEqual(labels(goNamesFor(inspection, arg(`app.Page("")`))), ["post", "login"], "pages, not documents");
  assert.deepEqual(labels(goNamesFor(inspection, arg(`rc.ActionURL("", nil)`))), ["logout"]);
  assert.deepEqual(labels(goNamesFor(inspection, goNameArgs(`app.URL("post", "", nil)`)[1])), ["en", "tr"]);
  assert.deepEqual(labels(goNamesFor(inspection, arg(`app.FragmentURL("", "", "", nil)`))), ["post"]);
  assert.deepEqual(labels(goNamesFor(inspection, goNameArgs(`app.FragmentURL("post", "", "", nil)`)[1])), ["comments"]);
});

test("a name the application does not have", () => {
  const arg = (go) => goNameArgs(go)[0];
  assert.equal(unknownGoName(inspection, arg(`collage.SeeOtherPage(rc, "posts", nil)`)), 'No page or document named "posts".');
  assert.equal(unknownGoName(inspection, arg(`session.RequireUserPage("signin")`)), 'No page or document named "signin".');
  assert.equal(unknownGoName(inspection, arg(`rc.ActionURL("vote", nil)`)), 'No action named "vote".');
  assert.equal(unknownGoName(inspection, arg(`app.Page("feed")`)), 'No page named "feed".');
  assert.equal(unknownGoName(inspection, arg(`collage.SeeOtherPage(rc, "post", nil)`)), undefined);
  assert.equal(unknownGoName(inspection, arg(`collage.SeeOtherPage(rc, "", nil)`)), undefined, "empty: still being typed");
  assert.equal(unknownGoName(inspection, goNameArgs('collage.SeeOtherPage(rc, "pos\n')[0]), undefined, "unterminated");
  assert.equal(unknownGoName({ ...inspection, actions: [] }, arg(`rc.ActionURL("vote", nil)`)), undefined, "no actions known: nothing to check against");
  assert.equal(unknownGoName(inspection, arg(`collage.SeeOtherPage(rc, "signup", nil)`), new Set(["signup"])), undefined, "declared in the file being edited");
});

test("the names a file declares", () => {
  const go = `collage.NewPage("signup").Build()
collage.NewDocument("rss", "application/xml")
collage.NewAction("vote")
collage.NewFragment("card", "card.html")`;
  assert.deepEqual([...declaredNames(go)].sort(), ["rss", "signup", "vote"]);
});
