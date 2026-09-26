// The checks, run inside the VS Code the runner started.
const vscode = require("vscode");
const assert = require("node:assert/strict");
const path = require("node:path");

async function run() {
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const file = process.env.EXPECT === "collage" ? path.join(folder, "templates", "page.html") : path.join(folder, "page.html");
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  const ext = vscode.extensions.getExtension("elagoht.collage-snippets-highlighter");
  await ext.activate();

  // Inside {{ }}: line 0, just after "{{ ".
  const list = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(0, 9));
  const labels = list.items.map((i) => (typeof i.label === "string" ? i.label : i.label.label));

  if (process.env.EXPECT === "plain") {
    assert.ok(!labels.includes("pageURL"), "offered collage's functions outside a collage project");
    return;
  }
  for (const want of ["slot", "pageURL", "asset", "fragmentURL", "t", "flashes", "cspNonce", "range"]) {
    assert.ok(labels.includes(want), `completion lacks ${want}; got ${labels.slice(0, 40).join(", ")}`);
  }
  const pageURL = list.items.find((i) => (typeof i.label === "string" ? i.label : i.label.label) === "pageURL");
  assert.equal(pageURL.insertText.value, 'pageURL "${1:name}"');

  // Hover over pageURL on line 1.
  const hovers = await vscode.commands.executeCommand("vscode.executeHoverProvider", doc.uri, new vscode.Position(1, 13));
  const text = hovers.flatMap((h) => h.contents.map((c) => (typeof c === "string" ? c : c.value))).join("\n");
  assert.match(text, /pageURL "name"/, `hover: ${text}`);

  // An attribute in a tag: line 2, inside "<div >".
  const attrs = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(2, 5));
  const attrLabels = attrs.items.map((i) => (typeof i.label === "string" ? i.label : i.label.label));
  assert.ok(attrLabels.includes("data-collage-fragment"), "no data-collage-* attributes in a tag");

  // The snippets are contributed.
  const snippetFile = require(path.join(ext.extensionPath, "snippets/html.json"));
  assert.ok(snippetFile["collage layout"]);
}

module.exports = { run };
