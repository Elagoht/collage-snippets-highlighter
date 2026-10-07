// Slot names in Go: `WithSlotFragment("…"` takes a slot the parent fragment's
// template calls with {{slot "…"}}. The parent is found by reading the builder
// chain back to its NewFragment or NewInlineFragment. Kept free of the vscode API
// so it can be tested in Node.
import { tokens, callArgs, stringValue, type GoToken } from "./embedded";
import { allCalls } from "./template";
import type { Inspection } from "./project";

/** The fragment a slot binding is made on, as far as the Go text says. */
export interface Parent {
  /** The name it is registered under, when a literal. */
  name?: string;
  /** NewFragment's template path, when a literal. */
  template?: string;
  /** NewInlineFragment's template text, when a raw string here or a const in this file. */
  inline?: string;
}

/** One `WithSlotFragment("name", …)`, `WithSlotResolver` or `WithSlot` call. */
export interface SlotBinding {
  method: string;
  /** The slot name's value, and its literal's offsets: quotes included. */
  value: string;
  start: number;
  end: number;
  /** Whether the literal is closed; while it is typed it may not be. */
  closed: boolean;
  parent?: Parent;
}

const BINDERS = new Set(["WithSlotFragment", "WithSlotResolver", "WithSlot"]);
const CONSTRUCTORS = new Set(["NewFragment", "NewInlineFragment"]);

/** slotBindings are the slot bindings of a Go file whose slot name is a string literal. */
export function slotBindings(go: string): SlotBinding[] {
  const toks = tokens(go);
  const out: SlotBinding[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ident" || !BINDERS.has(t.text) || toks[i + 1]?.text !== "(" || toks[i - 1]?.text !== ".") continue;
    const lit = toks[i + 2];
    if (!lit || (lit.kind !== "other" && lit.kind !== "raw") || !/^["`]/.test(lit.text)) continue;
    const value = stringValue(lit);
    const closed = lit.text.length > 1 && lit.text.endsWith(lit.text[0]) && value !== undefined;
    // An unterminated "…" runs to the end of its line, the line break included.
    const end = !closed && /[\r\n]$/.test(lit.text) ? lit.end - 1 : lit.end;
    out.push({
      method: t.text,
      value: value ?? go.slice(lit.start + 1, end),
      start: lit.start,
      end,
      closed,
      parent: parentOf(toks, i - 2),
    });
  }
  return out;
}

/** slotBindingAt is the binding whose slot-name literal the offset is inside. */
export function slotBindingAt(go: string, offset: number): SlotBinding | undefined {
  return slotBindings(go).find((b) => offset > b.start && (offset < b.end || (!b.closed && offset <= b.end)));
}

/** parentOf reads back from toks[j], the end of the receiver of a `.WithSlot…` call. */
function parentOf(toks: GoToken[], j: number): Parent | undefined {
  for (let guard = 0; guard < 200 && j >= 0; guard++) {
    const t = toks[j];
    if (t.text === ")") {
      // A call: find its "(", and what is called.
      let depth = 0;
      let k = j;
      for (; k >= 0; k--) {
        if (toks[k].text === ")") depth++;
        else if (toks[k].text === "(" && --depth === 0) break;
      }
      const callee = toks[k - 1];
      if (!callee || callee.kind !== "ident") return undefined;
      if (CONSTRUCTORS.has(callee.text)) return constructed(toks, k - 1);
      // A method of the chain: go on to its receiver.
      if (toks[k - 2]?.text !== ".") return undefined;
      j = k - 3;
      continue;
    }
    // `b.WithSlotFragment`, b a variable; `t.frag.WithSlotFragment` is a field, not followed.
    if (t.kind === "ident" && toks[j - 1]?.text !== ".") return assigned(toks, j);
    return undefined;
  }
  return undefined;
}

/** constructed reads NewFragment(name, path) or NewInlineFragment(name, html) at toks[i]. */
function constructed(toks: GoToken[], i: number): Parent {
  const { args } = callArgs(toks, i + 1);
  const name = args[0]?.length === 1 ? stringValue(args[0][0]) : undefined;
  const second = args[1]?.length === 1 ? args[1][0] : undefined;
  const parent: Parent = {};
  if (name !== undefined) parent.name = name;
  if (toks[i].text === "NewFragment") {
    const path = stringValue(second);
    if (path !== undefined) parent.template = path;
  } else if (second?.kind === "raw") {
    parent.inline = stringValue(second);
  } else if (second?.kind === "ident") {
    const text = constText(toks, second.text);
    if (text !== undefined) parent.inline = text;
  }
  return parent;
}

/** assigned follows a variable back to `v := collage.NewFragment(…)…` earlier in the file. */
function assigned(toks: GoToken[], j: number): Parent | undefined {
  const name = toks[j].text;
  for (let k = j - 1; k >= 0; k--) {
    // Not past the function the variable is used in: another's is another variable.
    if (toks[k].kind === "ident" && toks[k].text === "func") return undefined;
    if (toks[k].text !== name || toks[k].kind !== "ident") continue;
    let a = k + 1;
    if (toks[a]?.text === ":") a++;
    if (toks[a]?.text !== "=") continue;
    // The constructor the right-hand side starts with: `collage.NewFragment(` or `NewFragment(`.
    let c = a + 1;
    if (toks[c]?.kind === "ident" && toks[c + 1]?.text === ".") c += 2;
    if (toks[c]?.kind === "ident" && CONSTRUCTORS.has(toks[c].text) && toks[c + 1]?.text === "(") return constructed(toks, c);
    return undefined;
  }
  return undefined;
}

/** constText is the raw string a const or var of this file declared as InlineHTML, or plainly, holds. */
function constText(toks: GoToken[], ident: string): string | undefined {
  for (let k = 0; k < toks.length; k++) {
    if (toks[k].kind !== "ident" || toks[k].text !== ident) continue;
    let a = k + 1;
    if (toks[a]?.text === "collage" && toks[a + 1]?.text === ".") a += 2;
    if (toks[a]?.text === "InlineHTML") a++;
    if (toks[a]?.text === "=" && toks[a + 1]?.kind === "raw") return stringValue(toks[a + 1]);
  }
  return undefined;
}

/** templateByName is the template of the fragments registered as name, when they
 * all have one and the same: fragment names need not be unique. */
export function templateByName(inspection: Inspection | undefined, name: string): string | undefined {
  const templates = new Set((inspection?.fragments ?? []).filter((f) => f.name === name).map((f) => (f.inline ? "" : f.template)));
  return templates.size === 1 ? [...templates][0] || undefined : undefined;
}

/**
 * The slots a template calls by a literal name. Complete is false when it may call
 * others: a slot called by a name worked out as it renders, or a template it
 * includes, which collage follows and this does not.
 */
export function templateSlots(text: string): { names: string[]; complete: boolean } {
  const names: string[] = [];
  let complete = !/\{\{-?\s*(template|block)\b/.test(text);
  for (const call of allCalls(text)) {
    if (call.name !== "slot") continue;
    const arg = call.args[0];
    if (arg?.isString) {
      if (!names.includes(arg.value)) names.push(arg.value);
    } else complete = false;
  }
  return { names, complete };
}
