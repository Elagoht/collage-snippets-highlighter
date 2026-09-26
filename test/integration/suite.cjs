// The checks, run inside the VS Code the runner started.
const vscode = require("vscode");
const assert = require("node:assert/strict");
const path = require("node:path");

const label = (i) => (typeof i.label === "string" ? i.label : i.label.label);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, fn, timeout = 90000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out waiting for " + what);
    await sleep(500);
  }
}

async function run() {
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const ext = vscode.extensions.getExtension("elagoht.collage-snippets-highlighter");

  if (process.env.EXPECT === "plain") {
    const doc = await vscode.workspace.openTextDocument(path.join(folder, "page.html"));
    await vscode.window.showTextDocument(doc);
    await ext.activate();
    const list = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(0, 9));
    assert.ok(!list.items.map(label).includes("pageURL"), "offered collage's functions outside a collage project");
    return;
  }

  const doc = await vscode.workspace.openTextDocument(path.join(folder, "templates/pages/post.html"));
  await vscode.window.showTextDocument(doc);
  await ext.activate();

  // Wait for collage-inspect to answer.
  await until("inspection", async () => {
    const state = await vscode.commands.executeCommand("collage._state");
    if (state.some((p) => p.error)) throw new Error("inspect failed: " + JSON.stringify(state));
    return state.some((p) => p.pages?.includes("post"));
  }).catch(async (err) => {
    throw new Error(err.message + " state=" + JSON.stringify(await vscode.commands.executeCommand("collage._state")) + " file=" + doc.fileName);
  });

  // Page names: line 0, inside pageURL "".
  const pages = await until("page names", async () => {
    const list = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(0, 20));
    const labels = list.items.map(label);
    return labels.includes("post") && !labels.includes("href") ? labels : undefined;
  });
  assert.ok(!pages.includes("slot"), "function names offered inside a string");

  // The route's parameters: line 1, the second argument.
  const params = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(1, 27));
  assert.ok(params.items.map(label).includes("slug"), "no parameter names: " + params.items.map(label).slice(0, 30).join(", "));

  // A page that does not exist: line 2.
  const diags = await until("diagnostics", async () => {
    const d = vscode.languages.getDiagnostics(doc.uri).filter((x) => x.source === "collage");
    return d.length ? d : undefined;
  });
  assert.equal(diags.length, 1, JSON.stringify(diags.map((d) => d.message)));
  assert.match(diags[0].message, /posts/);
  assert.equal(diags[0].range.start.line, 2);

  // Go to where the page is declared: line 1, on "post".
  const defs = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", doc.uri, new vscode.Position(1, 21));
  assert.ok(defs.length === 1 && defs[0].uri.fsPath.endsWith("main.go"), "definition: " + JSON.stringify(defs));

  // flashes is described by collage-flash's collage.json: hover on line 3.
  const hover = await vscode.commands.executeCommand("vscode.executeHoverProvider", doc.uri, new vscode.Position(3, 50));
  const text = hover.flatMap((h) => h.contents.map((c) => (typeof c === "string" ? c : c.value))).join("\n");
  assert.match(text, /flash messages/, "hover: " + text);

  // plugins-config.json: a misspelt key under a known plugin.
  const cfg = await vscode.workspace.openTextDocument(path.join(folder, "plugins-config.json"));
  await vscode.window.showTextDocument(cfg);
  const cfgDiags = await until("schema diagnostics", async () => {
    const d = vscode.languages.getDiagnostics(cfg.uri);
    return d.length ? d : undefined;
  }, 30000);
  assert.ok(cfgDiags.some((d) => /cookiee/.test(d.message) || /not allowed/i.test(d.message)), JSON.stringify(cfgDiags.map((d) => d.message)));
}

module.exports = { run };
