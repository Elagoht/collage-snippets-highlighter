// A small reading of Go template actions: which function a string is an argument
// of, and in which position. Enough to complete `{{pageURL "…"}}` with page names
// and to check `{{slot "…"}}` against the slots a template has — not a parser for
// the whole language.

export interface Arg {
  /** A string literal's value; empty for anything else. */
  value: string;
  isString: boolean;
  /** Offsets in the document: the whole token, quotes included. */
  start: number;
  end: number;
}

export interface Call {
  name: string;
  nameStart: number;
  args: Arg[];
}

const KEYWORDS = new Set(["if", "else", "with", "range", "end", "define", "template", "block", "break", "continue"]);

interface Token {
  kind: "string" | "word" | "pipe" | "open" | "close" | "assign" | "other";
  text: string;
  value: string;
  start: number;
  end: number;
  closed: boolean;
}

/** Tokens of the action text from `from`, stopping at `to` or at the closing }}. */
function lex(text: string, from: number, to: number): Token[] {
  const out: Token[] = [];
  let i = from;
  while (i < to) {
    const c = text[i];
    if (c === "}" && text[i + 1] === "}") break;
    if (c === "-" && text[i + 1] === "}" && text[i + 2] === "}") break;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? to : end + 2;
      continue;
    }
    if (c === '"' || c === "`") {
      const start = i;
      let value = "";
      i++;
      let closed = false;
      while (i < to) {
        if (c === '"' && text[i] === "\\" && i + 1 < to) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === c) {
          closed = true;
          i++;
          break;
        }
        if (c === '"' && text[i] === "\n") break;
        value += text[i++];
      }
      out.push({ kind: "string", text: text.slice(start, i), value, start, end: i, closed });
      continue;
    }
    if (c === "|") {
      out.push({ kind: "pipe", text: c, value: "", start: i, end: ++i, closed: true });
      continue;
    }
    if (c === "(" || c === ")") {
      out.push({ kind: c === "(" ? "open" : "close", text: c, value: "", start: i, end: ++i, closed: true });
      continue;
    }
    if (c === ":" && text[i + 1] === "=") {
      out.push({ kind: "assign", text: ":=", value: "", start: i, end: (i += 2), closed: true });
      continue;
    }
    if (c === "=") {
      out.push({ kind: "assign", text: "=", value: "", start: i, end: ++i, closed: true });
      continue;
    }
    const m = /^[$.\w-]+/.exec(text.slice(i, Math.min(to, i + 256)));
    if (m) {
      out.push({ kind: "word", text: m[0], value: "", start: i, end: i + m[0].length, closed: true });
      i += m[0].length;
      continue;
    }
    out.push({ kind: "other", text: c, value: "", start: i, end: ++i, closed: true });
  }
  return out;
}

/** Calls in a token list: a function word followed by its arguments, per pipeline stage and paren group. */
function calls(tokens: Token[]): Call[] {
  const out: Call[] = [];
  const stack: (Call | null)[] = [null];
  let fresh = true; // at the start of a command: the next word may be a function
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const top = stack[stack.length - 1];
    switch (t.kind) {
      case "pipe":
        stack[stack.length - 1] = null;
        fresh = true;
        break;
      case "open":
        if (top) top.args.push({ value: "", isString: false, start: t.start, end: t.end });
        stack.push(null);
        fresh = true;
        break;
      case "close":
        if (stack.length > 1) stack.pop();
        fresh = false;
        break;
      case "assign":
        fresh = true;
        break;
      case "word":
        if (fresh && KEYWORDS.has(t.text)) break;
        // `$x :=` — a variable being declared, not a call.
        if (t.text.startsWith("$") && tokens[i + 1]?.kind === "assign") break;
        if (fresh && /^[A-Za-z_]\w*$/.test(t.text)) {
          const call: Call = { name: t.text, nameStart: t.start, args: [] };
          out.push(call);
          stack[stack.length - 1] = call;
          fresh = false;
        } else {
          top?.args.push({ value: "", isString: false, start: t.start, end: t.end });
          fresh = false;
        }
        break;
      case "string":
        top?.args.push({ value: t.value, isString: true, start: t.start, end: t.end });
        fresh = false;
        break;
      default:
        fresh = false;
    }
  }
  return out;
}

/** Every call in every action of text. */
export function allCalls(text: string): Call[] {
  const out: Call[] = [];
  let i = 0;
  for (;;) {
    const open = text.indexOf("{{", i);
    if (open < 0) break;
    let from = open + 2;
    if (text[from] === "-") from++;
    const close = text.indexOf("}}", from);
    const to = close < 0 ? text.length : close;
    out.push(...calls(lex(text, from, to)));
    i = to + 2;
  }
  return out;
}

export interface Position {
  /** The function whose argument the cursor is in. */
  call: Call;
  /** Which argument, from 0. */
  index: number;
  /** The string literal the cursor is in: where its content starts and ends. */
  contentStart: number;
  contentEnd: number;
}

/** Where the cursor at offset is, when it is inside a string argument of a call in an action. */
export function stringArgAt(text: string, offset: number): Position | undefined {
  const open = text.lastIndexOf("{{", offset - 1);
  if (open < 0 || text.lastIndexOf("}}", offset - 1) > open) return undefined;
  let from = open + 2;
  if (text[from] === "-") from++;
  const close = text.indexOf("}}", offset);
  const to = close < 0 ? text.length : close;
  const tokens = lex(text, from, to);
  for (const call of calls(tokens)) {
    const index = call.args.findIndex((a) => a.isString && offset > a.start && (offset < a.end || !tokenClosed(tokens, a)));
    if (index >= 0) {
      const arg = call.args[index];
      const closed = tokenClosed(tokens, arg);
      return { call, index, contentStart: arg.start + 1, contentEnd: closed ? arg.end - 1 : arg.end };
    }
  }
  return undefined;
}

function tokenClosed(tokens: Token[], arg: Arg): boolean {
  return tokens.find((t) => t.start === arg.start)?.closed ?? true;
}
