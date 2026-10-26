// Page, document and action names in Go: the string arguments of collage's
// functions and its plugins' that name a route the application registers —
// `collage.SeeOtherPage(rc, "post", …)`, `session.RequireUserPage("login")` —
// completed and checked against what collage-inspect reported, as {{pageURL}}'s
// are in a template. Kept free of the vscode API so it can be tested in Node.
import { tokens, callArgs, stringValue, type GoToken } from "./embedded";
import { actions, fragmentURL, locales, pages, routes, type Name } from "./names";
import type { Inspection } from "./project";

/** What a name argument names: a page or document (what collage.URL builds), a
 * page alone, an action, a locale, a page with fragment paths, or one of its
 * fragments. */
export type NameKind = "route" | "page" | "action" | "locale" | "fragmentPage" | "fragment";

/** One string literal argument that names something. */
export interface GoNameArg {
  /** The function or method called, unqualified. */
  call: string;
  kind: NameKind;
  /** The literal's value, and its offsets: quotes included. */
  value: string;
  start: number;
  end: number;
  /** Whether the literal is closed; while it is typed it may not be. */
  closed: boolean;
  /** For a fragment: the page named before it, when a literal. */
  page?: string;
}

/**
 * How a call is written: through collage's package name (or bare, collage
 * dot-imported), as a method of something else, or either.
 */
type Form = "any" | "collage" | "method";

/**
 * The calls whose arguments name a route, and the kind of each position. collage:
 * SeeOtherPage, GuardSeeOtherPage and URL take a page or document; a
 * RenderContext's and an App's URL, ActionURL and FragmentURL and App.PageURLs
 * are methods. App.Page is not: Page is a common method name — a docs site's
 * loaded.Page("intro") — and a warning there would be wrong. elagoht/session's RequireUserPage, RequirePage and
 * RequireGuestPage and elagoht/paginate's PathNamed are matched by their names
 * alone, which nothing else in collage's world has.
 */
const CALLS: { name: string; form: Form; kinds: (NameKind | undefined)[] }[] = [
  { name: "SeeOtherPage", form: "any", kinds: [undefined, "route"] },
  { name: "GuardSeeOtherPage", form: "any", kinds: [undefined, "route"] },
  { name: "URL", form: "collage", kinds: [undefined, "route"] },
  { name: "URL", form: "method", kinds: ["route", "locale"] },
  { name: "ActionURL", form: "method", kinds: ["action", "locale"] },
  { name: "FragmentURL", form: "method", kinds: ["fragmentPage", "fragment", "locale"] },
  { name: "PageURLs", form: "method", kinds: [undefined, "page"] },
  { name: "RequireUserPage", form: "any", kinds: ["route"] },
  { name: "RequirePage", form: "any", kinds: [undefined, "route"] },
  { name: "RequireGuestPage", form: "any", kinds: ["route"] },
  { name: "PathNamed", form: "any", kinds: [undefined, "route", "route"] },
];

const COLLAGE = "github.com/Elagoht/collage/pkg/collage";

/** The names collage is imported under in a file, and whether it is dot-imported;
 * "collage" when the file does not say (a fragment of code with no imports). */
function collageImport(toks: GoToken[]): { aliases: Set<string>; dot: boolean } {
  const aliases = new Set<string>();
  let dot = false;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "other" || stringValue(toks[i]) !== COLLAGE) continue;
    const prev = toks[i - 1];
    if (prev?.text === ".") dot = true;
    else if (prev?.kind === "ident" && prev.text !== "import") aliases.add(prev.text);
    else aliases.add("collage");
  }
  if (aliases.size === 0 && !dot) aliases.add("collage");
  return { aliases, dot };
}

/** A string literal token, closed or still being typed. */
function isLiteral(t: GoToken | undefined): t is GoToken {
  return t !== undefined && (t.kind === "other" || t.kind === "raw") && /^["`]/.test(t.text);
}

/** goNameArgs are the name arguments of a Go file that are a string literal on their own. */
export function goNameArgs(go: string): GoNameArg[] {
  const toks = tokens(go);
  const imported = collageImport(toks);
  const out: GoNameArg[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ident" || toks[i + 1]?.text !== "(") continue;
    const qualified = toks[i - 1]?.text === ".";
    const qualifier = qualified ? toks[i - 2] : undefined;
    let form: Form | undefined;
    if (!qualified) form = imported.dot ? "collage" : undefined;
    else if (qualifier?.kind === "ident" && imported.aliases.has(qualifier.text)) form = "collage";
    else form = "method";
    const entry = CALLS.find((c) => c.name === t.text && (c.form === "any" || c.form === form));
    if (!entry) continue;
    const { args } = callArgs(toks, i + 1);
    entry.kinds.forEach((kind, k) => {
      const lit = args[k]?.[0];
      if (!kind || !isLiteral(lit)) return;
      const value = stringValue(lit);
      const closed = lit.text.length > 1 && lit.text.endsWith(lit.text[0]) && value !== undefined;
      // `"po" + "st"` is not a name the editor can know.
      if (closed && args[k].length !== 1) return;
      // An unterminated "…" runs to the end of its line, the line break included.
      const end = !closed && /[\r\n]$/.test(lit.text) ? lit.end - 1 : lit.end;
      const arg: GoNameArg = { call: t.text, kind, value: value ?? go.slice(lit.start + 1, end), start: lit.start, end, closed };
      if (kind === "fragment" && args[0]?.length === 1) {
        const page = stringValue(args[0][0]);
        if (page !== undefined) arg.page = page;
      }
      out.push(arg);
    });
  }
  return out;
}

/** goNameArgAt is the name argument whose literal the offset is inside. */
export function goNameArgAt(go: string, offset: number): GoNameArg | undefined {
  return goNameArgs(go).find((a) => offset > a.start && (offset < a.end || (!a.closed && offset <= a.end)));
}

/** goNamesFor is what a name argument may be, and the names valid there; the
 * same lists {{pageURL}}, {{actionURL}} and {{fragmentURL}} complete with. */
export function goNamesFor(inspection: Inspection, arg: GoNameArg): { what: string; names: Name[] } | undefined {
  switch (arg.kind) {
    case "route":
      return routes(inspection);
    case "page":
      return pages(inspection);
    case "action":
      return actions(inspection);
    case "locale":
      return locales(inspection);
    case "fragmentPage":
      return fragmentURL(inspection, "", 0, "");
    case "fragment":
      return arg.page === undefined ? undefined : fragmentURL(inspection, arg.page, 1, "");
  }
}

/**
 * Whether a name argument names nothing the application has. Not while it is
 * typed, nor where nothing is known to check against, nor for a name the file
 * being edited declares: the inspection is of the last build, and may be from
 * before it.
 */
export function unknownGoName(inspection: Inspection, arg: GoNameArg, declared: Set<string> = new Set()): string | undefined {
  if (!arg.closed || arg.value === "" || declared.has(arg.value)) return undefined;
  const known = goNamesFor(inspection, arg);
  if (!known || known.names.length === 0) return undefined;
  if (known.names.some((n) => n.label === arg.value)) return undefined;
  return `No ${known.what} named "${arg.value}".`;
}

const DECLARERS = new Set(["NewPage", "NewDocument", "NewAction"]);

/** declaredNames are the page, document and action names a Go file registers with a literal. */
export function declaredNames(go: string): Set<string> {
  const toks = tokens(go);
  const out = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "ident" || !DECLARERS.has(toks[i].text) || toks[i + 1]?.text !== "(") continue;
    const value = stringValue(toks[i + 2]);
    if (value !== undefined && toks[i + 3]?.text !== "+") out.add(value);
  }
  return out;
}
