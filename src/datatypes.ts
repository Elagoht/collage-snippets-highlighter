// What a template's data is: the Go types collage-inspect reports for the
// fragments a template belongs to, followed through `.A.B` chains, `{{range}}`,
// `{{with}}` and variables, for completing `{{.` and flagging a field no fragment's
// data has. Kept free of the vscode API so it can be tested in Node.
//
// It is quieter than collage's own startup check by design: anything not certain
// is unknown, and nothing below an unknown value is reported.
import type { Inspection, InspectedFragment, InspectedType } from "./project";
import { lex, type Token } from "./template";

export type Types = Record<string, InspectedType>;

/** A Go type, read from the reflect string collage-inspect writes. */
export type GoType =
  | { kind: "named"; text: string } // a type the table describes
  | { kind: "pointer"; text: string; elem: GoType }
  | { kind: "slice"; text: string; elem: GoType }
  | { kind: "array"; text: string; elem: GoType }
  | { kind: "chan"; text: string; elem: GoType }
  | { kind: "map"; text: string; key: GoType; elem: GoType }
  | { kind: "basic"; text: string } // int, string, bool, …
  | { kind: "opaque"; text: string } // a named type the table does not describe: time.Time, template.HTML
  | { kind: "unknown"; text: string }; // interface, func, unnamed struct the table lacks

const BASIC = new Set([
  "bool", "string", "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr",
  "float32", "float64", "complex64", "complex128", "byte", "rune",
]);
const INTEGER = /^u?int(8|16|32|64)?$|^uintptr$|^byte$|^rune$/;

/** parseType reads a reflect type string: "*blog.User", "[]blog.Comment", "map[string]blog.Meta". */
export function parseType(s: string, types: Types): GoType {
  const text = s.trim();
  if (Object.prototype.hasOwnProperty.call(types, text)) return { kind: "named", text };
  if (text.startsWith("*")) return { kind: "pointer", text, elem: parseType(text.slice(1), types) };
  if (text.startsWith("[]")) return { kind: "slice", text, elem: parseType(text.slice(2), types) };
  const arr = /^\[(\d+)\]/.exec(text);
  if (arr) return { kind: "array", text, elem: parseType(text.slice(arr[0].length), types) };
  if (text.startsWith("map[")) {
    let depth = 0;
    for (let i = 3; i < text.length; i++) {
      if (text[i] === "[") depth++;
      else if (text[i] === "]" && --depth === 0) {
        return { kind: "map", text, key: parseType(text.slice(4, i), types), elem: parseType(text.slice(i + 1), types) };
      }
    }
    return { kind: "unknown", text };
  }
  const chan = /^(?:<-\s*chan|chan\s*<-|chan)\s+/.exec(text);
  if (chan) return { kind: "chan", text, elem: parseType(text.slice(chan[0].length), types) };
  if (/^(func|interface|struct)\b/.test(text) || text === "any" || text === "error") return { kind: "unknown", text };
  if (BASIC.has(text)) return { kind: "basic", text };
  return { kind: "opaque", text };
}

/**
 * A value in a template: the types it may have — one per fragment of a different
 * type serving the template — and whether some alternative is not known. Unknown
 * silences diagnostics; the known types still complete.
 */
export interface Value {
  types: GoType[];
  unknown: boolean;
}

export const UNKNOWN: Value = { types: [], unknown: true };

function value(types: GoType[], unknown: boolean): Value {
  const seen = new Set<string>();
  return { types: types.filter((t) => !seen.has(t.text) && seen.add(t.text)), unknown };
}

function deref(t: GoType): GoType {
  while (t.kind === "pointer") t = t.elem;
  return t;
}

type Lookup = { found: GoType } | { missing: true } | { unknown: true };

/** lookup is what `.name` gives on a value of type t. */
function lookup(t: GoType, name: string, types: Types): Lookup {
  const d = deref(t);
  if (d.kind === "named") {
    const entry = types[d.text];
    const field = entry.fields?.find((f) => f.name === name);
    if (field) return { found: parseType(field.type, types) };
    const method = entry.methods?.find((m) => m.name === name);
    if (method) return { found: parseType(method.returns, types) };
    // Only a struct's names are all known; a named map is looked up by key, and
    // other kinds are left to the startup check.
    return entry.kind === "struct" ? { missing: true } : { unknown: true };
  }
  // `.key` on a map[string]V is V; a key the map lacks only ends the chain.
  if (d.kind === "map") return d.key.kind === "basic" && d.key.text === "string" ? { found: d.elem } : { unknown: true };
  return { unknown: true };
}

/** A name a chain asks of a value none of whose types has it. */
export interface Missing {
  /** Which segment of the chain, from 0. */
  index: number;
  name: string;
  /** The types that lack it. */
  on: string[];
  /** The closest name they do have, when one is close. */
  suggestion?: string;
}

export interface Options {
  /** Names never reported missing: embedded fields, which the type table does
   * not list (their promoted fields it does). */
  embedded?: ReadonlySet<string>;
}

/** resolve follows `.a.b.c` from base; it stops at the first name none of the types has. */
export function resolve(base: Value, names: string[], types: Types, opts: Options = {}): { value: Value; missing?: Missing } {
  let cur = base;
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    const next: GoType[] = [];
    const on: string[] = [];
    let unknown = cur.unknown;
    for (const t of cur.types) {
      const r = lookup(t, name, types);
      if ("found" in r) next.push(r.found);
      else if ("missing" in r) on.push(t.text);
      else unknown = true;
    }
    if (next.length === 0 && on.length > 0 && !unknown) {
      if (opts.embedded?.has(name)) return { value: UNKNOWN };
      const candidates = cur.types.flatMap((t) => members(t, types).map((m) => m.name));
      return { value: UNKNOWN, missing: { index, name, on, suggestion: closest(name, candidates) } };
    }
    cur = value(next, unknown);
  }
  return { value: cur };
}

/** What `{{range}}` over a value gives: the key or index, and the element. */
export function rangeOf(v: Value, types: Types): { key: Value; elem: Value } {
  const keys: GoType[] = [];
  const elems: GoType[] = [];
  let unknown = v.unknown;
  for (const t of v.types) {
    const d = deref(t);
    if (d.kind === "slice" || d.kind === "array") {
      keys.push({ kind: "basic", text: "int" });
      elems.push(d.elem);
    } else if (d.kind === "chan") {
      elems.push(d.elem);
      unknown = true; // a channel has no key: one variable only
    } else if (d.kind === "map") {
      keys.push(d.key);
      elems.push(d.elem);
    } else if (d.kind === "basic" && INTEGER.test(d.text)) {
      keys.push(d);
      elems.push(d);
    } else {
      // A named container's element type is not in the table.
      unknown = true;
    }
  }
  return { key: value(keys, unknown), elem: value(elems, unknown) };
}

export interface Member {
  name: string;
  /** A field's type, or a method's result. */
  type: string;
  /** Set for a method: how many arguments it takes. */
  args?: number;
}

/** members are the fields and methods of a type, through pointers. */
export function members(t: GoType, types: Types): Member[] {
  const d = deref(t);
  if (d.kind !== "named") return [];
  const entry = types[d.text];
  return [
    ...(entry.fields ?? []).map((f) => ({ name: f.name, type: f.type })),
    ...(entry.methods ?? []).map((m) => ({ name: m.name, type: m.returns, args: m.args })),
  ];
}

/** A member offered for completion, with the types that have it. */
export interface Offered extends Member {
  on: string[];
  /** How many types the value may have: fewer in `on` means only some have it. */
  of: number;
}

/** offered are the members of every type a value may have, each once. */
export function offered(v: Value, types: Types): Offered[] {
  const out = new Map<string, Offered>();
  for (const t of v.types) {
    for (const m of members(t, types)) {
      const seen = out.get(m.name);
      if (seen) seen.on.push(t.text);
      else out.set(m.name, { ...m, on: [t.text], of: v.types.length });
    }
  }
  return [...out.values()];
}

/** The fragments a template serves, and the value its dot is. A fragment with no
 * data, an unknown type, or built WithoutTypeCheck makes the value unknown: its
 * names are not checked, though the known types' still complete. */
export function dataOf(fragments: InspectedFragment[], types: Types): Value {
  const out: GoType[] = [];
  let unknown = false;
  for (const f of fragments) {
    if (f.typeCheck === false) unknown = true;
    if (f.dataType == null || f.dataType === "nil") {
      unknown = true;
      continue;
    }
    out.push(parseType(f.dataType, types));
  }
  return value(out, unknown);
}

/**
 * fragmentsOfTemplate are the fragments rendering the template file at name, its
 * path under the template root. When none does — a template file system rooted
 * somewhere the inspection's templateRoot does not say, os.DirFS("templates") with
 * Root "." — the file's path from the project root is matched by its end.
 */
export function fragmentsOfTemplate(inspection: Inspection, name: string | undefined, fromRoot?: string): InspectedFragment[] {
  const ext = inspection.templateExtension || "";
  const files = inspection.fragments.filter((f) => !f.inline && f.template);
  const exact = name ? files.filter((f) => f.template === name || f.template + ext === name) : [];
  // A file outside the template root (name undefined) is no template at all.
  if (exact.length || !name || !fromRoot) return exact;
  return files.filter((f) => [f.template, f.template + ext].some((t) => fromRoot === t || fromRoot.endsWith("/" + t)));
}

/** fragmentsNamed are the inline fragments registered under one of names. */
export function fragmentsNamed(inspection: Inspection, names: string[]): InspectedFragment[] {
  return inspection.fragments.filter((f) => f.inline && names.includes(f.name));
}

// ---- The template, read action by action ----------------------------------

interface Frame {
  kind: string;
  dot: Value;
  /** The dot outside the block, which an {{else}} goes back to. */
  outer: Value;
  vars: Map<string, Value>;
}

/** The scope at a point of a template: what `.` is and the variables in reach. */
export interface Scope {
  dot: Value;
  vars: Map<string, Value>;
}

/** A name a template asks of data that does not have it. */
export interface Finding {
  /** Offsets of the name, the dot before it excluded. */
  start: number;
  end: number;
  message: string;
}

const CHAIN = /^(\$\w*)?((?:\.[A-Za-z_]\w*)+)$/;

/** The actions of text between start and end: where each opens, its content, and where it closes. */
function* actions(text: string, start: number, end: number): Generator<{ open: number; from: number; to: number; closed: boolean }> {
  let i = start;
  for (;;) {
    const open = text.indexOf("{{", i);
    if (open < 0 || open >= end) return;
    let from = open + 2;
    if (text[from] === "-" && /\s/.test(text[from + 1] ?? "")) from++;
    if (text.startsWith("/*", from) || (text[from] === " " && text.startsWith("/*", from + 1))) {
      const close = text.indexOf("*/", from);
      const stop = close < 0 ? end : text.indexOf("}}", close);
      i = stop < 0 ? end : stop + 2;
      continue;
    }
    const close = text.indexOf("}}", from);
    const closed = close >= 0 && close < end;
    const to = closed ? (text[close - 1] === "-" && /\s/.test(text[close - 2] ?? "") ? close - 1 : close) : end;
    yield { open, from, to, closed };
    if (!closed) return;
    i = close + 2;
  }
}

/**
 * Walks the template in text[start, end) — a file, or one inline template — with
 * root as its data. With `at`, it stops at the action the offset is in and
 * returns the scope there; it reports what no type has on the way.
 */
export function walk(text: string, start: number, end: number, root: Value, types: Types, opts: Options = {}, at?: number): { findings: Finding[]; scope: Scope } {
  const frames: Frame[] = [{ kind: "root", dot: root, outer: root, vars: new Map([["$", root]]) }];
  const findings: Finding[] = [];
  const top = () => frames[frames.length - 1];
  const variable = (name: string): Value => {
    for (let i = frames.length - 1; i >= 0; i--) {
      const v = frames[i].vars.get(name);
      if (v) return v;
    }
    return UNKNOWN;
  };
  const scope = (): Scope => {
    const vars = new Map<string, Value>();
    for (const f of frames) for (const [k, v] of f.vars) vars.set(k, v);
    return { dot: top().dot, vars };
  };

  /** The value a word is — `.`, `.A.B`, `$x.A`, `$` — reporting a missing name. */
  const chain = (text: string, t: Token, report: boolean): Value => {
    if (t.text === ".") return top().dot;
    const m = CHAIN.exec(t.text) ?? (/^\$\w*$/.test(t.text) ? [t.text, t.text, ""] : null);
    if (!m) return UNKNOWN;
    // `(x).A`: a field of what the parentheses give, which is not known here.
    if (text[t.start - 1] === ")") return UNKNOWN;
    const base = m[1] !== undefined && m[1] !== "" ? variable(m[1]) : top().dot;
    const names = m[2] ? m[2].slice(1).split(".") : [];
    const r = resolve(base, names, types, opts);
    if (r.missing && report) {
      let off = t.start + (m[1]?.length ?? 0);
      for (let i = 0; i < r.missing.index; i++) off += names[i].length + 1;
      findings.push({ start: off + 1, end: off + 1 + r.missing.name.length, message: missingMessage(r.missing) });
    }
    return r.value;
  };

  /** Every chain in the tokens is checked; the value of the pipeline when it is one operand. */
  const pipeline = (toks: Token[]): Value => {
    for (const t of toks) if (t.kind === "word") chain(text, t, true);
    let ts = toks;
    while (ts.length >= 2 && ts[0].kind === "open" && ts[ts.length - 1].kind === "close") ts = ts.slice(1, -1);
    if (ts.length === 1 && ts[0].kind === "word" && (ts[0].text === "." || ts[0].text.startsWith(".") || ts[0].text.startsWith("$"))) {
      return chain(text, ts[0], false);
    }
    return UNKNOWN; // a function's result, a literal, a pipe: not known
  };

  /** `$a, $b :=` or `$a :=` at the start of toks: the variables and the rest. */
  const declaration = (toks: Token[]): { names: string[]; assign?: string; rest: Token[] } => {
    const names: string[] = [];
    let i = 0;
    while (toks[i]?.kind === "word" && toks[i].text.startsWith("$") && !toks[i].text.includes(".")) {
      names.push(toks[i].text);
      i++;
      if (toks[i]?.text === ",") i++;
      else break;
    }
    if (names.length && toks[i]?.kind === "assign") return { names, assign: toks[i].text, rest: toks.slice(i + 1) };
    return { names: [], rest: toks };
  };

  for (const a of actions(text, start, end)) {
    if (at !== undefined && at >= a.from && (at <= a.to || !a.closed)) return { findings, scope: scope() };
    // An action still being typed runs into the next one — `{{.` before an
    // `{{end}}` — and the template does not parse: nothing after it is certain.
    if (text.slice(a.from, a.to).includes("{{")) return { findings, scope: scope() };
    const toks = lex(text, a.from, a.to);
    if (toks.length === 0) continue;
    const head = toks[0].kind === "word" ? toks[0].text : "";
    const frame = top();
    switch (head) {
      case "end":
        if (frames.length > 1) frames.pop();
        break;
      case "else": {
        frame.dot = frame.outer;
        const kw = toks[1]?.kind === "word" ? toks[1].text : "";
        if (kw === "with") {
          const d = declaration(toks.slice(2));
          const v = pipeline(d.rest);
          frame.dot = v;
          for (const n of d.names) frame.vars.set(n, v);
        } else if (kw === "if") {
          pipeline(toks.slice(2));
        }
        break;
      }
      case "if":
        pipeline(toks.slice(1));
        frames.push({ kind: "if", dot: frame.dot, outer: frame.dot, vars: new Map() });
        break;
      case "with": {
        const d = declaration(toks.slice(1));
        const v = pipeline(d.rest);
        frames.push({ kind: "with", dot: v, outer: frame.dot, vars: new Map(d.names.map((n) => [n, v])) });
        break;
      }
      case "range": {
        const d = declaration(toks.slice(1));
        const { key, elem } = rangeOf(pipeline(d.rest), types);
        const vars = new Map<string, Value>();
        if (d.names.length === 1) vars.set(d.names[0], elem);
        else if (d.names.length >= 2) {
          vars.set(d.names[0], key);
          vars.set(d.names[1], elem);
        }
        frames.push({ kind: "range", dot: elem, outer: frame.dot, vars });
        break;
      }
      case "define":
      case "block":
        // Whatever invokes it decides what it sees: unknown, $ included.
        if (head === "block") pipeline(toks.slice(2));
        frames.push({ kind: head, dot: UNKNOWN, outer: UNKNOWN, vars: new Map([["$", UNKNOWN]]) });
        break;
      default: {
        const d = declaration(toks);
        const v = pipeline(d.rest);
        for (const n of d.names) {
          if (d.assign === ":=") frame.vars.set(n, v);
          else {
            // `$x = …` keeps the variable, of whichever type it now holds.
            for (let i = frames.length - 1; i >= 0; i--) {
              const old = frames[i].vars.get(n);
              if (old) {
                frames[i].vars.set(n, value([...old.types, ...v.types], true));
                break;
              }
            }
          }
        }
      }
    }
  }
  return { findings, scope: scope() };
}

function missingMessage(m: Missing): string {
  const types = m.on.length === 1 ? `type ${m.on[0]} has no` : `none of ${m.on.join(", ")} has a`;
  return `${types} field or method ${m.name}${m.suggestion ? ` (did you mean ${m.suggestion}?)` : ""}`;
}

/** closest is the candidate within a small edit distance of name, if any. */
function closest(name: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDist = Math.max(1, Math.min(3, Math.floor(name.length / 3)));
  for (const c of new Set(candidates)) {
    const d = distance(name.toLowerCase(), c.toLowerCase());
    if (d < bestDist || (d === bestDist && best === undefined)) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** distance is the edit distance of a and b, a swap of two neighbours counting as one edit. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// ---- Completion ----------------------------------------------------------------

export type Completion =
  | { kind: "members"; items: Offered[]; start: number; end: number }
  | { kind: "variables"; items: { name: string; value: Value }[]; start: number; end: number };

/**
 * What to complete at offset in a template in text[start, end): the fields and
 * methods after `.`, `.A.`, `$x.` or `$.`; the variables in reach after `$`.
 */
export function completeAt(text: string, start: number, end: number, offset: number, root: Value, types: Types, opts: Options = {}): Completion | undefined {
  const open = text.lastIndexOf("{{", offset - 1);
  if (open < start || text.lastIndexOf("}}", offset - 1) > open) return undefined;
  const before = text.slice(open + 2, offset);
  const after = /^\w*/.exec(text.slice(offset))?.[0] ?? "";
  const { scope } = walk(text, start, end, root, types, opts, offset);

  const m = /(\$\w*)?((?:\.[A-Za-z_]\w*)*)\.(\w*)$/.exec(before);
  if (m) {
    const lead = before[m.index - 1];
    // A field of a parenthesised result, or the dot in a number: not known.
    if (lead !== undefined && /[\w)\]"'`]/.test(lead)) return undefined;
    const base = m[1] ? scope.vars.get(m[1]) ?? UNKNOWN : scope.dot;
    const names = m[2] ? m[2].slice(1).split(".") : [];
    const r = resolve(base, names, types, opts);
    if (r.missing) return undefined;
    return { kind: "members", items: offered(r.value, types), start: offset - m[3].length, end: offset + after.length };
  }
  const v = /\$(\w*)$/.exec(before);
  if (v) {
    const lead = before[v.index - 1];
    if (lead !== undefined && /[\w)]/.test(lead)) return undefined;
    return {
      kind: "variables",
      items: [...scope.vars].map(([name, value]) => ({ name, value })),
      start: offset - v[0].length,
      end: offset + after.length,
    };
  }
  return undefined;
}

/** typeLabel is how a value's types read in a completion's detail. */
export function typeLabel(v: Value): string {
  return v.types.map((t) => t.text).join(" | ") || "unknown";
}

// ---- Embedded fields -----------------------------------------------------------

/**
 * embeddedFields are the names of the fields Go source embeds in its structs —
 * `struct { Base; *auth.User }` embeds Base and User. The type table lists the
 * fields an embedded struct promotes but not the embedded field itself, which a
 * template may still name: `{{.Base.ID}}`. A name among these is never reported.
 */
export function embeddedFields(go: string): string[] {
  const out = new Set<string>();
  for (const m of go.matchAll(/\bstruct\s*\{([^{}]*)\}/g)) {
    for (const line of m[1].split(/[\n;]/)) {
      const e = /^\s*\*?(?:[A-Za-z_]\w*\.)?([A-Z]\w*)(?:\[[^\]]*\])?\s*(?:`[^`]*`|"[^"]*")?\s*(?:\/\/.*)?$/.exec(line);
      if (e) out.add(e[1]);
    }
  }
  return [...out];
}
