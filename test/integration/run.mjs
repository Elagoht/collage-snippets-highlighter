// Runs the extension in a VS Code of its own — its own user data and extensions,
// so nothing of the developer's editor is touched — against two workspaces: a
// collage project and a folder that is not one.
import { runTests } from "@vscode/test-electron";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "collage-ext-"));

const project = join(scratch, "site");
mkdirSync(join(project, "templates"), { recursive: true });
writeFileSync(join(project, "go.mod"), "module site\n\ngo 1.26\n\nrequire github.com/Elagoht/collage v0.26.0\n");
writeFileSync(join(project, "templates", "page.html"), `<main>{{ }}</main>\n<a href="{{pageURL "home"}}">x</a>\n<div ></div>\n`);

const plain = join(scratch, "plain");
mkdirSync(plain, { recursive: true });
writeFileSync(join(plain, "page.html"), `<main>{{ }}</main>\n`);

const executable = process.env.VSCODE_EXECUTABLE ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
for (const [workspace, expect] of [[project, "collage"], [plain, "plain"]]) {
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: root,
    extensionTestsPath: join(root, "test/integration/suite.cjs"),
    launchArgs: [workspace, "--disable-extensions", "--user-data-dir", join(scratch, "user"), "--extensions-dir", join(scratch, "ext")],
    extensionTestsEnv: { EXPECT: expect },
  });
}
console.log("integration: both workspaces passed");
