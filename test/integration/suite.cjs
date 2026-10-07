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

  // Action names and their parameters: line 4.
  const actionNames = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(4, 27));
  assert.ok(actionNames.items.map(label).includes("vote"), "no action names: " + actionNames.items.map(label).slice(0, 30).join(", "));
  const actionParams = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(4, 73));
  assert.ok(actionParams.items.map(label).includes("slug"), "no action parameters: " + actionParams.items.map(label).slice(0, 30).join(", "));
  const actionDefs = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", doc.uri, new vscode.Position(4, 67));
  assert.ok(actionDefs.length === 1 && actionDefs[0].uri.fsPath.endsWith("main.go"), "action definition: " + JSON.stringify(actionDefs));

  // flashes is described by collage-flash's collage.json: hover on line 3.
  const hover = await vscode.commands.executeCommand("vscode.executeHoverProvider", doc.uri, new vscode.Position(3, 50));
  const text = hover.flatMap((h) => h.contents.map((c) => (typeof c === "string" ? c : c.value))).join("\n");
  assert.match(text, /flash messages/, "hover: " + text);

  // The data's fields at {{. — line 5, the post's Post — and inside {{with .Author}}.
  const fields = (await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(5, 7), ".")).items;
  const field = fields.find((i) => label(i) === "Title");
  assert.ok(field && field.kind === vscode.CompletionItemKind.Field, "no Title at {{.: " + fields.map(label).slice(0, 30).join(", "));
  assert.ok(!fields.map(label).includes("pageURL"), "functions offered after a dot");
  const inner = (await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(5, doc.lineAt(5).text.indexOf("{{.Name") + 3), ".")).items.map(label);
  assert.ok(inner.includes("Name") && !inner.includes("Title"), "with .Author does not narrow: " + inner.slice(0, 30).join(", "));

  // A field the data does not have: a warning, beside the unknown page.
  const editor0 = vscode.window.activeTextEditor;
  await editor0.edit((e) => e.insert(new vscode.Position(6, 0), "{{.Titel}}"));
  const dataDiags = await until("a data diagnostic", async () => {
    const d = vscode.languages.getDiagnostics(doc.uri).filter((x) => x.source === "collage" && /Titel/.test(x.message));
    return d.length ? d : undefined;
  }, 30000);
  assert.equal(dataDiags[0].severity, vscode.DiagnosticSeverity.Warning);
  assert.match(dataDiags[0].message, /type main\.Post has no field or method Titel \(did you mean Title\?\)/);

  // Unsaved Go code pauses the field warnings: the table may be about to change.
  const goMain = await vscode.workspace.openTextDocument(path.join(folder, "main.go"));
  const goEditor = await vscode.window.showTextDocument(goMain);
  await goEditor.edit((e) => e.insert(new vscode.Position(0, 0), "// renamed a field\n"));
  await until("field warnings paused", async () => !vscode.languages.getDiagnostics(doc.uri).some((x) => /Titel/.test(x.message)), 30000);
  await vscode.commands.executeCommand("workbench.action.files.revert");
  await until("field warnings back", async () => vscode.languages.getDiagnostics(doc.uri).some((x) => /Titel/.test(x.message)), 30000);
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand("workbench.action.files.revert");

  // "." in a tag asks for nothing: no attribute list.
  const inTag = (await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(6, 3), ".")).items.map(label);
  assert.ok(!inTag.some((l) => l.startsWith("data-collage")), "attributes offered for a typed dot: " + inTag.slice(0, 20).join(", "));

  // A template under the root that no fragment renders: its path's end is not enough.
  const admin = await vscode.workspace.openTextDocument(path.join(folder, "templates/admin/pages/post.html"));
  await vscode.window.showTextDocument(admin);
  await sleep(2000);
  assert.deepEqual(vscode.languages.getDiagnostics(admin.uri).filter((x) => x.source === "collage").map((d) => d.message), []);

  // WithSlotFragment(" in Go: the slots the parent's template calls.
  const main = await vscode.workspace.openTextDocument(path.join(folder, "main.go"));
  await vscode.window.showTextDocument(main);
  const slotAt = main.positionAt(main.getText().indexOf('WithSlotFragment("aside"') + 'WithSlotFragment("'.length);
  const slotNames = (await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", main.uri, slotAt, '"')).items.map(label);
  assert.ok(slotNames.includes("aside"), "no slot names: " + slotNames.slice(0, 30).join(", "));

  // Go function snippets bring the package clause and the imports they need.
  const header = async (file) => {
    const go = await vscode.workspace.openTextDocument(path.join(folder, file));
    await vscode.window.showTextDocument(go);
    const list = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", go.uri, new vscode.Position(0, 0));
    const item = list.items.find((i) => label(i) === "cfragf");
    assert.ok(item, "no cfragf in " + file + ": " + list.items.map(label).slice(0, 30).join(", "));
    return (item.additionalTextEdits ?? []).map((e) => e.newText).join("");
  };
  assert.equal(await header("components/new.go"), 'package components\n\nimport "github.com/Elagoht/collage/pkg/collage"\n\n');
  assert.match(await header("auth-layout/new.go"), /^package authlayout\n/);

  // Inline HTML in Go is edited as HTML is.
  const inline = await vscode.workspace.openTextDocument(path.join(folder, "components/inline.go"));
  const editor = await vscode.window.showTextDocument(inline);
  const at = (needle, delta = needle.length) => inline.positionAt(inline.getText().indexOf(needle) + delta);
  const complete = async (pos) => (await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", inline.uri, pos)).items;

  const tags = (await complete(at("<di"))).map(label);
  assert.ok(tags.includes("div"), "no HTML tags in inline HTML: " + tags.slice(0, 30).join(", "));
  const emmet = (await complete(at("ul>li*2"))).find((i) => label(i) === "ul>li*2");
  assert.ok(emmet && /Emmet/.test(emmet.detail), "no Emmet expansion in inline HTML");
  const snippetItems = await complete(at("cform"));
  const snippets = snippetItems.map(label);
  assert.ok(snippets.includes("cformv"), "no HTML snippets in inline HTML: " + snippets.slice(0, 40).join(", "));
  const twice = [...new Set(snippets)].filter((l) => snippets.filter((x) => x === l).length > 1);
  assert.deepEqual(twice, [], "offered twice: " + twice.join(", "));
  assert.ok(!snippets.includes("cfragf"), "a Go snippet offered inside the HTML");
  const inlinePages = await until("page names in inline HTML", async () => {
    const labels = (await complete(at('pageURL ""', 9))).map(label);
    return labels.includes("post") ? labels : undefined;
  }, 30000);
  assert.ok(inlinePages.includes("post"));

  const hoverUl = await vscode.commands.executeCommand("vscode.executeHoverProvider", inline.uri, at("<ul>", 2));
  assert.match(hoverUl.flatMap((h) => h.contents.map((c) => (typeof c === "string" ? c : c.value))).join("\n"), /list/i, "no HTML hover");

  const folds = await vscode.commands.executeCommand("vscode.executeFoldingRangeProvider", inline.uri);
  assert.ok(folds.some((f) => f.start === at("<ul>").line), "the <ul> does not fold: " + JSON.stringify(folds));

  const highlights = await vscode.commands.executeCommand("vscode.executeDocumentHighlights", inline.uri, at("<section", 3));
  assert.equal(highlights?.length, 2, "the matching tag is not highlighted");

  const inlineDiags = await until("diagnostics in inline HTML", async () => {
    const d = vscode.languages.getDiagnostics(inline.uri).filter((x) => x.source === "collage");
    return d.length ? d : undefined;
  }, 30000);
  assert.equal(inlineDiags.length, 1, JSON.stringify(inlineDiags.map((d) => d.message)));
  assert.equal(inlineDiags[0].range.start.line, at('"posts"').line);

  // Typing ">" closes the tag.
  editor.selection = new vscode.Selection(at("<span"), at("<span"));
  await vscode.commands.executeCommand("type", { text: ">" });
  await until("the tag closed", async () => inline.lineAt(at("<span").line).text === "<span></span>", 5000);

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
