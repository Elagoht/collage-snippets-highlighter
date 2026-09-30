// HTML inside Go edited as HTML is: completion, snippets, hover, folding, the
// matching tag, Emmet, a tag closed as it is typed, a tag pair renamed together.
//
// Each Go file with inline HTML has a virtual HTML document beside it: the file
// with everything but its HTML blanked out, so a position in one is the same
// position in the other. What VS Code answers for an HTML document — its HTML
// support, snippets, other extensions, this extension's own template completion —
// is asked of the virtual document and handed back. What no request can be
// forwarded for is computed here, with the libraries VS Code's HTML support is
// built on. Every provider answers only inside an inline region, so the Go around
// it is left to Go.
import * as vscode from "vscode";
import { inlineRegions, regionAt, virtualHTML, type Region } from "./embedded";
import { emmetCompletions, linkedRanges, tagCompletion } from "./htmlservice";

export const SCHEME = "collage-embedded";

/** The virtual HTML documents, one per Go document, kept in step with it. */
export class VirtualDocuments implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;
  private readonly texts = new Map<string, string>();
  private readonly regions = new WeakMap<vscode.TextDocument, { version: number; regions: Region[] }>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.texts.get(uri.toString()) ?? "";
  }

  /** regionsOf returns the inline regions of a Go document, read once per version. */
  regionsOf(doc: vscode.TextDocument): Region[] {
    const cached = this.regions.get(doc);
    if (cached?.version === doc.version) return cached.regions;
    const regions = inlineRegions(doc.getText());
    this.regions.set(doc, { version: doc.version, regions });
    return regions;
  }

  /** regionAt returns the region pos is in, if any. */
  regionAt(doc: vscode.TextDocument, pos: vscode.Position): Region | undefined {
    return regionAt(this.regionsOf(doc), doc.offsetAt(pos));
  }

  html(doc: vscode.TextDocument): string {
    return virtualHTML(doc.getText(), this.regionsOf(doc));
  }

  /** uriFor is the virtual document of a Go document. Its path is the Go file's
   * with ".html" after it: the language is HTML, and the project is the Go
   * file's. */
  static uriFor(goUri: vscode.Uri): vscode.Uri {
    return vscode.Uri.from({ scheme: SCHEME, path: goUri.path + ".html", query: goUri.toString() });
  }

  /** goUriOf is the Go document a virtual one belongs to. */
  static goUriOf(uri: vscode.Uri): vscode.Uri | undefined {
    return uri.scheme === SCHEME ? vscode.Uri.parse(uri.query) : undefined;
  }

  /** sync brings the virtual document of doc up to date and returns it: asked
   * before the document says what it now holds, VS Code would answer for the
   * text it held before. */
  async sync(doc: vscode.TextDocument): Promise<vscode.Uri> {
    const uri = VirtualDocuments.uriFor(doc.uri);
    const key = uri.toString();
    const text = this.html(doc);
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    this.texts.set(key, text);
    if (!open) {
      await vscode.workspace.openTextDocument(uri);
    } else if (open.getText() !== text) {
      const changed = new Promise<void>((resolve) => {
        const timer = setTimeout(done, 500);
        const sub = vscode.workspace.onDidChangeTextDocument((e) => {
          if (e.document.uri.toString() === key && e.document.getText() === text) done();
        });
        function done(): void {
          clearTimeout(timer);
          sub.dispose();
          resolve();
        }
      });
      this.emitter.fire(uri);
      await changed;
    }
    return uri;
  }
}

/** register adds the providers for Go documents with inline HTML. */
export function register(context: vscode.ExtensionContext, docs: VirtualDocuments): void {
  const go: vscode.DocumentSelector = { language: "go" };
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, docs),
    vscode.languages.registerCompletionItemProvider(go, new Completion(docs), "<", "/", " ", ":", '"', "{", "(", "|", "-", ".", "!", "=", ">", "*", "+"),
    vscode.languages.registerHoverProvider(go, new Hover(docs)),
    vscode.languages.registerDefinitionProvider(go, new Definition(docs)),
    vscode.languages.registerFoldingRangeProvider(go, new Folding(docs)),
    vscode.languages.registerDocumentHighlightProvider(go, new Highlights(docs)),
    vscode.languages.registerLinkedEditingRangeProvider(go, new LinkedEditing(docs)),
    vscode.workspace.onDidChangeTextDocument((e) => autoClose(docs, e)),
  );
}

class Completion implements vscode.CompletionItemProvider {
  constructor(private readonly docs: VirtualDocuments) {}

  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position, _token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionList | undefined> {
    if (!this.docs.regionAt(doc, pos)) return undefined;
    const uri = await this.docs.sync(doc);
    const forwarded = await vscode.commands.executeCommand<vscode.CompletionList>("vscode.executeCompletionItemProvider", uri, pos, context.triggerCharacter);
    // Snippets are left out: the grammar marks the region HTML, so VS Code
    // offers HTML's snippets there itself, and forwarded they would be listed twice.
    const items = (forwarded?.items ?? []).filter((i) => i.kind !== vscode.CompletionItemKind.Snippet);
    // Emmet's, as VS Code's Emmet extension would put them first in an HTML file.
    const emmet = emmetCompletions(this.docs.html(doc), doc.offsetAt(pos)).map((e) => {
      const item = new vscode.CompletionItem(e.label, vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(e.newText);
      item.range = new vscode.Range(doc.positionAt(e.start), doc.positionAt(e.end));
      item.detail = "Emmet Abbreviation";
      item.documentation = new vscode.MarkdownString().appendCodeblock(e.newText.replace(/\$\{\d+(?::([^}]*))?\}|\$\d+/g, "$1"), "html");
      item.sortText = "\u0000" + e.label;
      return item;
    });
    return new vscode.CompletionList([...emmet, ...items], (forwarded?.isIncomplete ?? false) || emmet.length > 0);
  }
}

class Hover implements vscode.HoverProvider {
  constructor(private readonly docs: VirtualDocuments) {}

  async provideHover(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover | undefined> {
    if (!this.docs.regionAt(doc, pos)) return undefined;
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", await this.docs.sync(doc), pos);
    if (!hovers?.length) return undefined;
    return new vscode.Hover(hovers.flatMap((h) => h.contents), hovers.find((h) => h.range)?.range);
  }
}

class Definition implements vscode.DefinitionProvider {
  constructor(private readonly docs: VirtualDocuments) {}

  async provideDefinition(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Location[] | undefined> {
    if (!this.docs.regionAt(doc, pos)) return undefined;
    const found = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>("vscode.executeDefinitionProvider", await this.docs.sync(doc), pos);
    return found?.map((l) => ("targetUri" in l ? new vscode.Location(l.targetUri, l.targetRange) : l));
  }
}

class Folding implements vscode.FoldingRangeProvider {
  constructor(private readonly docs: VirtualDocuments) {}

  async provideFoldingRanges(doc: vscode.TextDocument): Promise<vscode.FoldingRange[] | undefined> {
    if (this.docs.regionsOf(doc).length === 0) return undefined;
    return vscode.commands.executeCommand<vscode.FoldingRange[]>("vscode.executeFoldingRangeProvider", await this.docs.sync(doc));
  }
}

class Highlights implements vscode.DocumentHighlightProvider {
  constructor(private readonly docs: VirtualDocuments) {}

  async provideDocumentHighlights(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.DocumentHighlight[] | undefined> {
    if (!this.docs.regionAt(doc, pos)) return undefined;
    return vscode.commands.executeCommand<vscode.DocumentHighlight[]>("vscode.executeDocumentHighlights", await this.docs.sync(doc), pos);
  }
}

class LinkedEditing implements vscode.LinkedEditingRangeProvider {
  constructor(private readonly docs: VirtualDocuments) {}

  provideLinkedEditingRanges(doc: vscode.TextDocument, pos: vscode.Position): vscode.LinkedEditingRanges | undefined {
    if (!this.docs.regionAt(doc, pos)) return undefined;
    const spans = linkedRanges(this.docs.html(doc), doc.offsetAt(pos));
    if (!spans?.length) return undefined;
    return new vscode.LinkedEditingRanges(spans.map((s) => new vscode.Range(doc.positionAt(s.start), doc.positionAt(s.end))));
  }
}

/** autoClose closes a tag as its ">" is typed, and completes "</", as VS Code does
 * in an HTML file — following the same setting, html.autoClosingTags. */
function autoClose(docs: VirtualDocuments, e: vscode.TextDocumentChangeEvent): void {
  const doc = e.document;
  if (doc.languageId !== "go" || e.reason !== undefined || e.contentChanges.length !== 1) return;
  const change = e.contentChanges[0];
  if (change.rangeLength !== 0 || (change.text !== ">" && change.text !== "/")) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== doc || editor.selections.length !== 1) return;
  if (!vscode.workspace.getConfiguration("html", doc).get<boolean>("autoClosingTags", true)) return;

  const offset = change.rangeOffset + 1;
  const pos = doc.positionAt(offset);
  if (!docs.regionAt(doc, pos)) return;
  const version = doc.version;
  // After the keystroke is done, as VS Code's HTML support waits: inside the
  // change event an edit is refused, and the cursor has not moved past the ">".
  setTimeout(() => {
    if (doc.version !== version || !editor.selection.active.isEqual(pos)) return;
    const snippet = tagCompletion(docs.html(doc), offset, change.text as ">" | "/");
    if (snippet) void editor.insertSnippet(new vscode.SnippetString(snippet), pos);
  }, 100);
}
