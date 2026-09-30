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

interface Token {
  kind: "ident" | "raw" | "punct" | "other";
  text: string;
  start: number;
  end: number;
}

/** tokens reads Go's tokens, skipping whitespace and comments. Interpreted strings
 * and runes are one token each; what they say does not matter here. */
function tokens(go: string): Token[] {
  const out: Token[] = [];
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
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < go.length && /\w/.test(go[j])) j++;
      out.push({ kind: "ident", text: go.slice(i, j), start: i, end: j });
      i = j;
    } else {
      out.push({ kind: "punct", text: c, start: i, end: i + 1 });
      i++;
    }
  }
  return out;
}

const content = (t: Token): Region => ({ start: t.start + 1, end: t.text.endsWith("`") && t.text.length > 1 ? t.end - 1 : t.end });

/** inlineRegions returns the HTML regions of a Go file, in order. */
export function inlineRegions(go: string): Region[] {
  const toks = tokens(go);
  const out: Region[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ident") continue;
    if (t.text === "NewInlineFragment" && toks[i + 1]?.text === "(") {
      // The first raw string among the call's arguments, the parentheses balanced.
      let depth = 0;
      for (let j = i + 1; j < toks.length; j++) {
        const u = toks[j];
        if (u.text === "(") depth++;
        else if (u.text === ")" && --depth === 0) break;
        else if (u.kind === "raw" && depth === 1) {
          out.push(content(u));
          break;
        }
      }
    } else if (t.text === "InlineHTML" && toks[i + 1]?.text === "=" && toks[i + 2]?.kind === "raw") {
      out.push(content(toks[i + 2]));
    }
  }
  return out;
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
