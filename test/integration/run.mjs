// Runs the extension in a VS Code of its own — its own user data and extensions,
// so nothing of the developer's editor is touched — against a real collage
// application, and against a folder that is not one.
import { runTests } from "@vscode/test-electron";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const src = process.env.COLLAGE_SRC ?? join(homedir(), "Desktop");
const scratch = mkdtempSync(join(tmpdir(), "collage-ext-"));

// A collage application: `go run . collage-inspect` answers, and collage-flash's
// collage.json is found through the module graph.
const project = join(scratch, "site");
for (const dir of ["templates/pages", "static"]) mkdirSync(join(project, dir), { recursive: true });
writeFileSync(join(project, "go.mod"), `module site

go 1.26

require (
	github.com/Elagoht/collage v0.27.0
	github.com/Elagoht/collage-flash v0.1.1
)

replace github.com/Elagoht/collage => ${join(src, "collage")}

replace github.com/Elagoht/collage-flash => ${join(src, "collage-flash")}
`);
writeFileSync(join(project, "main.go"), `package main

import (
	"bytes"
	"context"
	"flag"
	"os"

	flash "github.com/Elagoht/collage-flash"
	"github.com/Elagoht/collage/pkg/collage"
)

func main() {
	flag.Parse()
	app, err := collage.New(&collage.Config{
		Server:   collage.ServerConfig{Host: "localhost", Port: 3000},
		Template: collage.TemplateConfig{FS: os.DirFS("templates"), Root: "."},
		Plugins:  []collage.Plugin{flash.New(flash.Options{Key: bytes.Repeat([]byte("k"), 32)})},
	})
	if err != nil {
		panic(err)
	}
	post := collage.NewFragment("post", "pages/post.html").Build()
	if err := app.RegisterPage(collage.NewPage("post").WithContent(post).WithPath("en", "/blog/{slug}").Build()); err != nil {
		panic(err)
	}
	vote := collage.NewAction("vote").WithPath("en", "/blog/{slug}/vote").WithMethods("POST").
		WithHandler(func(context.Context, *collage.RenderContext) (*collage.ActionResult, error) { return nil, nil }).Build()
	if err := app.RegisterAction(vote); err != nil {
		panic(err)
	}
	if err := app.Mount("/static/", os.DirFS("static")); err != nil {
		panic(err)
	}
	code, _ := collage.DispatchCommands(context.Background(), app, flag.Args())
	os.Exit(code)
}
`);
writeFileSync(join(project, "templates/pages/post.html"), [
  `<a href="{{pageURL ""}}">x</a>`,
  `<a href="{{pageURL "post" ""}}">x</a>`,
  `<a href="{{pageURL "posts"}}">x</a>`,
  `<link href="{{asset "/static/app.css"}}">{{range flashes}}{{.Text}}{{end}}`,
  `<form action="{{actionURL ""}}"></form><form action="{{actionURL "vote" ""}}"></form>`,
  "",
].join("\n"));
writeFileSync(join(project, "static/app.css"), "body{}\n");
// Go files for the function snippets: an empty one beside a file that names its
// package, and an empty one in a directory with nothing else in it.
for (const dir of ["components", "auth-layout"]) mkdirSync(join(project, dir), { recursive: true });
writeFileSync(join(project, "components/card.go"), "// Package components is the site's parts.\npackage components\n");
writeFileSync(join(project, "components/new.go"), "");
writeFileSync(join(project, "auth-layout/new.go"), "");
writeFileSync(join(project, "plugins-config.json"), `{ "elagoht/flash": { "cookiee": "x" } }\n`);
execFileSync("go", ["mod", "tidy"], { cwd: project, stdio: "inherit" });

const plain = join(scratch, "plain");
mkdirSync(plain, { recursive: true });
writeFileSync(join(plain, "page.html"), `<main>{{ }}</main>\n`);

const executable = process.env.VSCODE_EXECUTABLE ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
for (const [workspace, expect] of [[project, "collage"], [plain, "plain"]]) {
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: root,
    extensionTestsPath: join(root, "test/integration/suite.cjs"),
    // The JSON language features stay on: the schema check needs them.
    launchArgs: [workspace, "--user-data-dir", join(scratch, "user"), "--extensions-dir", join(scratch, "ext")],
    extensionTestsEnv: { EXPECT: expect },
  });
}
console.log("integration: both workspaces passed");
