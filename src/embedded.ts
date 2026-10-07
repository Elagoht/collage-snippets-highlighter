// The HTML written inside Go: the raw string among collage.NewInlineFragment's
// arguments, and the raw string a const or var declared as collage.InlineHTML
// holds — what the inline grammar colours. Found by reading Go's tokens, so a
// comment or a string that mentions either is not taken for one. Kept free of the
// vscode API so it can be tested in Node.

/** A region of HTML: offsets of its text, the backticks excluded. */
export interface Region {
  start: number;
  end: number;
}

export interface GoToken {
  kind: "ident" | "raw" | "punct" | "other";
  text: string;
  start: number;
  end: number;
}

/** tokens reads Go's tokens, skipping whitespace and comments. Interpreted strings
 * and runes are one token each; what they say does not matter here. */
export function tokens(go: string): GoToken[] {
  const out: GoToken[] = [];
  let i = 0;
  while (i < go.length) {
    const c = go[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
    } else if (go.startsWith("//", i)) {
      const nl = go.indexOf("\n", i);
      i = nl < 0 ? go.length : nl;
    } else if (go.startsWith("/*", i)) {
      const end = go.indexOf("*/", i + 2);
      i = end < 0 ? go.length : end + 2;
    } else if (c === "`") {
      const end = go.indexOf("`", i + 1);
      const stop = end < 0 ? go.length : end + 1;
      out.push({ kind: "raw", text: go.slice(i, stop), start: i, end: stop });
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < go.length && go[j] !== c && go[j] !== "\n") j += go[j] === "\\" ? 2 : 1;
      out.push({ kind: "other", text: go.slice(i, j + 1), start: i, end: j + 1 });
      i = j + 1;
    } else if (/[\p{L}_]/u.test(c)) {
      let j = i + 1;
      while (j < go.length && /[\p{L}\p{N}_]/u.test(go[j])) j++;
      out.push({ kind: "ident", text: go.slice(i, j), start: i, end: j });
      i = j;
    } else {
      out.push({ kind: "punct", text: c, start: i, end: i + 1 });
      i++;
    }
  }
  return out;
}

const content = (t: GoToken): Region => ({ start: t.start + 1, end: t.text.endsWith("`") && t.text.length > 1 ? t.end - 1 : t.end });

/** An inline template and what it belongs to: the fragment name NewInlineFragment
 * was given as a literal, or the const or var that holds it. */
export interface InlineTemplate extends Region {
  /** The fragment's name, when the raw string is NewInlineFragment's own argument
   * and the name before it is a string literal. */
  fragment?: string;
  /** The identifier declared as collage.InlineHTML that holds the raw string. */
  ident?: string;
}

/** stringValue is a Go string literal's value; undefined for anything else. */
export function stringValue(t: GoToken | undefined): string | undefined {
  if (!t) return undefined;
  if (t.kind === "raw") return t.text.slice(1, t.text.endsWith("`") && t.text.length > 1 ? -1 : undefined);
  if (t.kind !== "other" || !t.text.startsWith('"')) return undefined;
  try {
    const v: unknown = JSON.parse(t.text);
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** callArgs splits the arguments of the call whose "(" is toks[open] at its
 * top-level commas; each argument is its tokens. */
export function callArgs(toks: GoToken[], open: number): { args: GoToken[][]; close: number } {
  const args: GoToken[][] = [[]];
  let depth = 0;
  for (let j = open; j < toks.length; j++) {
    const u = toks[j];
    if (u.text === "(" || u.text === "[" || u.text === "{") {
      if (depth++ === 0) continue;
    } else if (u.text === ")" || u.text === "]" || u.text === "}") {
      if (--depth === 0) return { args: args.filter((a, i) => a.length > 0 || i < args.length - 1), close: j };
    } else if (u.text === "," && depth === 1) {
      args.push([]);
      continue;
    }
    args[args.length - 1].push(u);
  }
  return { args, close: toks.length };
}

/** inlineTemplates returns the HTML regions of a Go file, in order, with what each belongs to. */
export function inlineTemplates(go: string): InlineTemplate[] {
  const toks = tokens(go);
  const out: InlineTemplate[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ident") continue;
    if (t.text === "NewInlineFragment" && toks[i + 1]?.text === "(") {
      // The first raw string among the call's arguments, the parentheses balanced.
      const { args } = callArgs(toks, i + 1);
      for (let a = 0; a < args.length; a++) {
        const raw = args[a][0]?.kind === "raw" ? args[a][0] : undefined;
        if (!raw) continue;
        const name = a === 1 && args[0].length === 1 ? stringValue(args[0][0]) : undefined;
        out.push({ ...content(raw), ...(name !== undefined && { fragment: name }) });
        break;
      }
    } else if (t.text === "InlineHTML" && toks[i + 1]?.text === "=" && toks[i + 2]?.kind === "raw") {
      // `name collage.InlineHTML = ` or `name InlineHTML = `.
      const before = toks[i - 1]?.text === "." ? toks[i - 3] : toks[i - 1];
      out.push({ ...content(toks[i + 2]), ...(before?.kind === "ident" && { ident: before.text }) });
    }
  }
  return out;
}

/** inlineUses maps each identifier a Go file passes to NewInlineFragment as its
 * template to the fragment names it is passed with: `NewInlineFragment("row", rowHTML)`. */
export function inlineUses(go: string): Map<string, string[]> {
  const toks = tokens(go);
  const out = new Map<string, string[]>();
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "ident" || toks[i].text !== "NewInlineFragment" || toks[i + 1]?.text !== "(") continue;
    const { args } = callArgs(toks, i + 1);
    const name = args[0]?.length === 1 ? stringValue(args[0][0]) : undefined;
    const ident = args[1]?.length === 1 && args[1][0].kind === "ident" ? args[1][0].text : undefined;
    if (name !== undefined && ident) out.set(ident, [...(out.get(ident) ?? []), name]);
  }
  return out;
}

/** inlineRegions returns the HTML regions of a Go file, in order. */
export function inlineRegions(go: string): Region[] {
  return inlineTemplates(go).map((r) => ({ start: r.start, end: r.end }));
}

/** virtualHTML is the Go file with everything but its HTML blanked out: every
 * character a space, every line break kept, so an offset in one is the same
 * offset in the other. */
export function virtualHTML(go: string, regions: Region[] = inlineRegions(go)): string {
  let out = "";
  let at = 0;
  for (const r of regions) {
    out += go.slice(at, r.start).replace(/[^\n\r]/g, " ") + go.slice(r.start, r.end);
    at = r.end;
  }
  return out + go.slice(at).replace(/[^\n\r]/g, " ");
}

/** regionAt returns the region offset is in: between its backticks, either end included. */
export function regionAt(regions: Region[], offset: number): Region | undefined {
  return regions.find((r) => offset >= r.start && offset <= r.end);
}
