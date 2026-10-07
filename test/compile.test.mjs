// Every Go snippet compiles against the collage and plugins it is written for.
// Each one, its placeholders at their defaults and every choice tried, goes into a
// package of its own in a throwaway module, under the package clause and imports
// the extension itself would add, beside stub packages for the application's own
// (fragments, layouts, actions, domain …) and the few lines a handler's body needs
// around it. Then go vet.
//
// The versions are test/compile/go.mod's; with the module cache warm it runs
// offline. It skips when go is not installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { choices, expand } from "./expand.mjs";

const require = createRequire(import.meta.url);
const { functionSnippets, headerEdits, COLLAGE_IMPORT } = require("../out/src/gosnippets.js");

const MODULE = "snippetcheck";
const CONTEXT = "context";
const HTTP = "net/http";
const TIME = "time";
const VALIDATE = "github.com/Elagoht/collage-validate";

let haveGo = true;
try {
  execFileSync("go", ["version"], { stdio: "ignore" });
} catch {
  haveGo = false;
}

// The application's own packages, as a scaffolded project has them. A snippet
// that calls one with other arguments brings its own in stubs.
const commonStubs = {
  domain: {
    imports: [HTTP],
    src: [
      "type Service struct{}",
      "func (s *Service) Allows(r *http.Request) bool { return r != nil }",
      "func FieldErrors(err error) map[string]string { return nil }",
      "func Save() error { return nil }",
    ],
  },
  layouts: { imports: [COLLAGE_IMPORT], src: ["func Layout() *collage.Fragment { return nil }"] },
  guards: { imports: [COLLAGE_IMPORT, "@/domain"], src: ["func Guard(*domain.Service) collage.GuardFunc { return nil }"] },
  funcs: { imports: [COLLAGE_IMPORT, "@/domain"], src: ["func Action(*domain.Service) collage.ActionHandlerFunc { return nil }"] },
  pages: { imports: [COLLAGE_IMPORT], src: ["func Name() *collage.Page { return nil }"] },
  errorpages: { imports: [COLLAGE_IMPORT], src: ["func NotFoundPage() *collage.Page { return nil }"] },
};

// What a snippet needs that is not a whole declaration: wrap puts the body inside
// a function, context is declarations beside it, stubs replaces stub packages.
// A wrap's or context's imports are its own; the snippet's come from the snippet.
const specs = {
  cpage: { stubs: { fragments: { imports: [COLLAGE_IMPORT], src: ["func Name() *collage.Fragment { return nil }"] } } },
  cpagea: {
    stubs: {
      fragments: { imports: [COLLAGE_IMPORT], src: ["func Name() *collage.Fragment { return nil }"] },
      actions: { imports: [COLLAGE_IMPORT, "@/domain"], src: ["func Name(*domain.Service) *collage.Action { return nil }"] },
    },
  },
  cpagep: {
    stubs: { fragments: { imports: [COLLAGE_IMPORT, "@/domain"], src: ["func Name(*domain.Service) *collage.Fragment { return nil }"] } },
  },
  cpage404: { stubs: { fragments: { imports: [COLLAGE_IMPORT], src: ["func NotFound() *collage.Fragment { return nil }"] } } },
  cfrags: {
    context: {
      imports: [COLLAGE_IMPORT],
      src: ["func condition(*collage.RenderContext) bool { return true }", "var first, otherwise *collage.Fragment"],
    },
  },
  cload: {
    wrap: { imports: [COLLAGE_IMPORT], before: "var _ collage.Data = ", after: "" },
    context: { imports: [], src: ["type nameView struct{}"] },
  },
  cstate: {
    context: {
      imports: [COLLAGE_IMPORT],
      src: ["func _(rc *collage.RenderContext) bool {", "\tnameKey.Set(rc, nameState{})", "\t_, ok := nameKey.Get(rc)", "\treturn ok", "}"],
    },
  },
  cval: {
    wrap: {
      imports: [CONTEXT, COLLAGE_IMPORT],
      before: "func _(_ context.Context, rc *collage.RenderContext) (*collage.ActionResult, error) {",
      after: "return nil, nil\n}",
    },
  },
  cvf: {
    wrap: { imports: [COLLAGE_IMPORT, VALIDATE], before: "func _(rc *collage.RenderContext) {\nv := validate.Form(rc)", after: "}" },
  },
  cvfail: {
    wrap: {
      imports: [COLLAGE_IMPORT],
      before: "func _(rc *collage.RenderContext) (*collage.ActionResult, error) {\nv := validate.Form(rc)",
      after: "}",
    },
  },
  cvfields: {
    wrap: {
      imports: [COLLAGE_IMPORT, "@/domain"],
      before: "func _(rc *collage.RenderContext) (*collage.ActionResult, error) {\nv := validate.Form(rc)\nerr := domain.Save()",
      after: "return nil, nil\n}",
    },
  },
  cflash: { wrap: { imports: [COLLAGE_IMPORT], before: "func _(rc *collage.RenderContext) {", after: "}" } },
  credir: {
    wrap: { imports: [COLLAGE_IMPORT], before: "func _(rc *collage.RenderContext) (*collage.ActionResult, error) {", after: "}" },
  },
  ccookie: {
    wrap: { imports: [HTTP, COLLAGE_IMPORT], before: "func _(target string, cookie *http.Cookie) (*collage.ActionResult, error) {", after: "}" },
  },
  cnotfound: {
    wrap: { imports: [], before: "func _(id int64) (nameView, error) {", after: "}" },
    context: { imports: [], src: ["type nameView struct{}"] },
  },
  cmeta: { wrap: { imports: [COLLAGE_IMPORT], before: "func _(rc *collage.RenderContext, canonical string) {", after: "}" } },
  cjsonld: {
    wrap: {
      imports: [TIME, COLLAGE_IMPORT],
      before: "func _(rc *collage.RenderContext, headline, description, url string, published time.Time, author string) {",
      after: "}",
    },
  },
  cdoc: { context: { imports: [], src: ["var body []byte"] } },
  ccached: {
    wrap: { imports: [COLLAGE_IMPORT], before: "func _(rc *collage.RenderContext) error {", after: "_ = value\nreturn err\n}" },
    context: {
      imports: [CONTEXT, COLLAGE_IMPORT],
      src: [
        "type Result struct{}",
        "var nameKey = collage.NewKey[Result](\"name\")",
        "func fetch(context.Context) (Result, error) { return Result{}, nil }",
      ],
    },
  },
  cinval: { wrap: { imports: [COLLAGE_IMPORT], before: "func _(result *collage.ActionResult) {", after: "}" } },
  cmw: { wrap: { imports: [COLLAGE_IMPORT], before: "func _(app *collage.App) (*collage.App, error) {", after: "return app, nil\n}" } },
  ctest: { test: true },
  ctestf: { test: true },
  cplugin: { context: { imports: [COLLAGE_IMPORT], src: ["var _ collage.Plugin = (*Plugin)(nil)"] } },
  chook: {
    context: (choice) => ({
      imports: [COLLAGE_IMPORT],
      src: ["type Plugin struct{}", `var _ collage.${["AfterRender", "BeforeRender"][choice]}Hook = (*Plugin)(nil)`],
    }),
  },
};
specs.conce = specs.ccached;
for (const p of ["ctest", "ctestf"]) {
  specs[p].context = { imports: [COLLAGE_IMPORT], src: ["func newApp(devMode bool, port int) (*collage.App, error) { return nil, nil }"] };
}

// file writes a Go file of package pkg: its header from headerEdits, the
// extension's own, with "@/x" imports made the stub package x's path.
function file(path, pkg, prefix, imports, text) {
  const resolved = imports.map((p) => (p.startsWith("@/") ? `${MODULE}/${prefix}/${p.slice(2)}` : p));
  const edits = headerEdits(text, pkg, resolved);
  const out = [...edits].sort((a, b) => b.offset - a.offset).reduce((t, e) => t.slice(0, e.offset) + e.text + t.slice(e.offset), text);
  writeFileSync(path, out + "\n");
}

const topLevel = (body) => /^(\/\/[^\n]*\n)*(func|const|type|var) /.test(body);

test("every Go snippet compiles against collage v0.50.0 and its plugins", { skip: !haveGo && "go is not installed", timeout: 600_000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "collage-snippets-"));
  try {
    copyFileSync(new URL("./compile/go.mod", import.meta.url), join(root, "go.mod"));
    copyFileSync(new URL("./compile/go.sum", import.meta.url), join(root, "go.sum"));
    const packages = [];
    for (const s of functionSnippets) {
      const spec = specs[s.prefix] ?? {};
      for (let k = 0; k < choices(s.body); k++) {
        const body = expand(s.body, k);
        if (!topLevel(body) && !spec.wrap) assert.fail(`${s.prefix}: lines of a function, and no wrap for them in compile.test.mjs`);
        const pkg = k === 0 ? s.prefix : `${s.prefix}${k}`;
        const dir = join(root, pkg);
        mkdirSync(dir);
        packages.push(pkg);

        const text = spec.wrap ? `${spec.wrap.before}\n${body}\n${spec.wrap.after}` : body;
        const stubs = { ...commonStubs, ...(spec.stubs ?? {}) };
        const used = Object.keys(stubs).filter((name) => new RegExp(`(^|[^.\\w])${name}\\.`).test(text));
        const imports = [...s.imports, ...(spec.wrap?.imports ?? []), ...used.map((n) => `@/${n}`)];
        file(join(dir, spec.test ? "snippet_test.go" : "snippet.go"), pkg, pkg, imports, text);

        const context = typeof spec.context === "function" ? spec.context(k) : spec.context;
        if (context) file(join(dir, "context.go"), pkg, pkg, context.imports, context.src.join("\n"));

        // A stub a stub imports (domain, for guards) is written too.
        const needed = new Set(used);
        for (const n of used) for (const p of stubs[n].imports) if (p.startsWith("@/")) needed.add(p.slice(2));
        for (const n of needed) {
          mkdirSync(join(dir, n));
          file(join(dir, n, `${n}.go`), n, pkg, stubs[n].imports, stubs[n].src.join("\n"));
        }
      }
    }
    try {
      execFileSync("go", ["vet", "./..."], {
        cwd: root,
        env: { ...process.env, GOFLAGS: "-mod=readonly", GOWORK: "off" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      assert.fail(`go vet:\n${e.stderr}`);
    }
    assert.ok(packages.length >= functionSnippets.length);
  } catch (e) {
    e.message += `\n(the generated module is kept in ${root})`;
    throw e;
  }
  rmSync(root, { recursive: true, force: true });
});
