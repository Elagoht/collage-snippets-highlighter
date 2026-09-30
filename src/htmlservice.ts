// The editing VS Code gives an HTML file that no request can be forwarded for:
// a tag closed as its ">" is typed, the two names of a tag pair edited together,
// and Emmet — whose completions VS Code's Emmet extension offers only to a
// document open in an editor. Run on the virtual HTML of a Go file, with the
// libraries VS Code's own HTML support is built on. Offsets in, offsets out, and
// no vscode API, so it can be tested in Node.
import { getLanguageService } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { doComplete as emmetComplete } from "@vscode/emmet-helper";

const html = getLanguageService();

function parse(text: string): { doc: TextDocument; parsed: ReturnType<typeof html.parseHTMLDocument> } {
  const doc = TextDocument.create("collage-embedded:/inline.html", "html", 0, text);
  return { doc, parsed: html.parseHTMLDocument(doc) };
}

/** tagCompletion is what to insert when typed — ">" or "/" — has just been typed
 * at offset: a snippet closing the element, or nothing. */
export function tagCompletion(text: string, offset: number, typed: ">" | "/"): string | undefined {
  if (text[offset - 1] !== typed) return undefined;
  const { doc, parsed } = parse(text);
  return html.doTagComplete(doc, doc.positionAt(offset), parsed) ?? undefined;
}

function emmetCanExpandAt(text: string, offset: number): boolean {
  const inside = (open: string, close: string) => {
    const at = text.lastIndexOf(open, offset - 1);
    return at >= 0 && text.lastIndexOf(close, offset - 1) < at;
  };
  if (inside("{{", "}}") || inside("<!--", "-->")) return false;
  const { parsed } = parse(text);
  const node = parsed.findNodeAt(offset);
  // In the node's start tag: its name, an attribute, a value.
  if (node.tag && offset > node.start && (node.startTagEnd === undefined || offset < node.startTagEnd)) return false;
  // In a script's or a style's content: another language.
  if ((node.tag === "script" || node.tag === "style") && node.startTagEnd !== undefined && offset >= node.startTagEnd) return false;
  return true;
}

/** A range of the text, as offsets. */
export interface Span {
  start: number;
  end: number;
}

/** linkedRanges are the names of the tag pair at offset, to be edited as one. */
export function linkedRanges(text: string, offset: number): Span[] | undefined {
  const { doc, parsed } = parse(text);
  const ranges = html.findLinkedEditingRanges(doc, doc.positionAt(offset), parsed);
  return ranges?.map((r) => ({ start: doc.offsetAt(r.start), end: doc.offsetAt(r.end) }));
}

/** An Emmet expansion: the abbreviation's span and the snippet it becomes. */
export interface Expansion extends Span {
  label: string;
  newText: string;
  detail?: string;
}

/** emmetCompletions are Emmet's expansions of the abbreviation before offset,
 * where VS Code's Emmet offers them in an HTML file: between elements. Not in a
 * {{…}} action, which Emmet would read as text to expand, and not in a script, a
 * style, a tag or a comment — the check VS Code's Emmet extension makes, which
 * the helper library leaves to it. Offered there, accepting it would turn
 * `pencil.hidden` into an element. */
export function emmetCompletions(text: string, offset: number): Expansion[] {
  if (!emmetCanExpandAt(text, offset)) return [];
  const doc = TextDocument.create("collage-embedded:/inline.html", "html", 0, text);
  const list = emmetComplete(doc, doc.positionAt(offset), "html", { showExpandedAbbreviation: "always", showSuggestionsAsSnippets: false });
  const out: Expansion[] = [];
  for (const item of list?.items ?? []) {
    const edit = item.textEdit;
    if (!edit || !("range" in edit)) continue;
    out.push({ label: item.label, newText: edit.newText, detail: item.detail, start: doc.offsetAt(edit.range.start), end: doc.offsetAt(edit.range.end) });
  }
  return out;
}
