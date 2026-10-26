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
  /** Whether the call is collage's (or the plugin's) for certain: a package
   * function through its import, or a method of a receiver the file declares as
   * collage's App, RenderContext or Host. Only then is an unknown name reported. */
  certain: boolean;
}

/**
 * The calls whose arguments name a route, and the kind of each position.
 * collage's functions — SeeOtherPage, GuardSeeOtherPage, URL — and the plugins'
 * — elagoht/session's RequireUserPage, RequirePage and RequireGuestPage,
 * elagoht/paginate's PathNamed — are matched only through the name the file
 * imports that package as. The methods of collage's App, RenderContext and Host
 * — URL, ActionURL, FragmentURL, PageURLs — are matched on any receiver, since
 * the type of an expression is not known here; a warning needs the receiver to
 * be declared in the file with one of those types. App.Page is left out: Page is
 * a common method name — a docs site's loaded.Page("intro").
 */
const FUNCS: { name: string; pkg: string; kinds: (NameKind | undefined)[] }[] = [
  { name: "SeeOtherPage", pkg: "collage", kinds: [undefined, "route"] },
  { name: "GuardSeeOtherPage", pkg: "collage", kinds: [undefined, "route"] },
  { name: "URL", pkg: "collage", kinds: [undefined, "route"] },
  { name: "RequireUserPage", pkg: "session", kinds: ["route"] },
  { name: "RequirePage", pkg: "session", kinds: [undefined, "route"] },
  { name: "RequireGuestPage", pkg: "session", kinds: ["route"] },
  { name: "PathNamed", pkg: "paginate", kinds: [undefined, "route", "route"] },
];
const METHODS: { name: string; kinds: (NameKind | undefined)[] }[] = [
  { name: "URL", kinds: ["route", "locale"] },
  { name: "ActionURL", kinds: ["action", "locale"] },
  { name: "FragmentURL", kinds: ["fragmentPage", "fragment", "locale"] },
  { name: "PageURLs", kinds: [undefined, "page"] },
];

/** The packages, by the name their package clause gives them. */
const PACKAGES: Record<string, string> = {
  collage: "github.com/Elagoht/collage/pkg/collage",
  session: "github.com/Elagoht/collage-session",
  paginate: "github.com/Elagoht/collage-paginate",
};

/** collage's types whose methods take route names. */
const RECEIVER_TYPES = new Set(["App", "RenderContext", "Host"]);

/** The names a package is imported under in a file, and whether it is
 * dot-imported. A file with no import declaration — a fragment of code — is
 * taken to import it under its own name. */
interface Imported {
  names: Set<string>;
  dot: boolean;
}

function importsOf(toks: GoToken[]): Map<string, Imported> {
  const out = new Map<string, Imported>();
  let any = false;
  const spec = (j: number): number => {
    let alias: string | undefined;
    if (toks[j]?.kind === "ident" || toks[j]?.text === ".") alias = toks[j++].text;
    const path = stringValue(toks[j]);
    if (path === undefined) return j + 1;
    any = true;
    const pkg = Object.keys(PACKAGES).find((k) => PACKAGES[k] === path);
    if (pkg) {
      const entry = out.get(pkg) ?? { names: new Set<string>(), dot: false };
      if (alias === ".") entry.dot = true;
      else if (alias !== "_") entry.names.add(alias ?? pkg);
      out.set(pkg, entry);
    }
    return j + 1;
  };
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== "ident" || toks[i].text !== "import") continue;
    if (toks[i + 1]?.text === "(") {
      let j = i + 2;
      while (j < toks.length && toks[j].text !== ")") j = toks[j].text === ";" ? j + 1 : spec(j);
      i = j;
    } else i = spec(i + 1) - 1;
  }
  if (!any) for (const pkg of Object.keys(PACKAGES)) out.set(pkg, { names: new Set([pkg]), dot: false });
  return out;
}

/** The identifiers a file declares as one of collage's App, RenderContext or
 * Host: `rc *collage.RenderContext` in a parameter list or var declaration,
 * `host collage.Host`, `app, err := collage.New(…)`. */
function collageReceivers(toks: GoToken[], collage: Set<string>): Set<string> {
  const out = new Set<string>();
  const typed = (j: number) => {
    if (toks[j]?.text === "*") j++;
    return toks[j]?.kind === "ident" && collage.has(toks[j].text) && toks[j + 1]?.text === "." && RECEIVER_TYPES.has(toks[j + 2]?.text ?? "");
  };
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.kind !== "ident" || toks[k - 1]?.text === ".") continue;
    if (typed(k + 1)) {
      out.add(t.text);
      continue;
    }
    // `app := collage.New(`, `app, err := collage.New(`, and with `=`.
    let a = k + 1;
    if (toks[a]?.text === "," && toks[a + 1]?.kind === "ident") a += 2;
    if (toks[a]?.text === ":") a++;
    if (toks[a]?.text !== "=" || toks[a + 1]?.text === "=") continue;
    const q = toks[a + 1];
    if (q?.kind === "ident" && collage.has(q.text) && toks[a + 2]?.text === "." && toks[a + 3]?.text === "New" && toks[a + 4]?.text === "(") out.add(t.text);
  }
  return out;
}

/** A string literal token, closed or still being typed. */
function isLiteral(t: GoToken | undefined): t is GoToken {
  return t !== undefined && (t.kind === "other" || t.kind === "raw") && /^["`]/.test(t.text);
}

/** goNameArgs are the name arguments of a Go file that are a string literal on their own. */
export function goNameArgs(go: string): GoNameArg[] {
  const toks = tokens(go);
  const imports = importsOf(toks);
  const collage = imports.get("collage")?.names ?? new Set<string>();
  let receivers: Set<string> | undefined;
  const out: GoNameArg[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ident" || toks[i + 1]?.text !== "(") continue;
    const qualified = toks[i - 1]?.text === ".";
    const qualifier = qualified ? toks[i - 2] : undefined;
    let kinds: (NameKind | undefined)[] | undefined;
    let certain = true;
    // A package's function: through the name the file imports it as, or bare
    // when it is dot-imported.
    const func = FUNCS.find((f) => {
      if (f.name !== t.text) return false;
      const imported = imports.get(f.pkg);
      if (!imported) return false;
      if (!qualified) return imported.dot;
      return qualifier?.kind === "ident" && toks[i - 3]?.text !== "." && imported.names.has(qualifier.text);
    });
    if (func) kinds = func.kinds;
    else if (qualified && !(qualifier?.kind === "ident" && collage.has(qualifier.text))) {
      const method = METHODS.find((m) => m.name === t.text);
      if (method) {
        kinds = method.kinds;
        receivers ??= collageReceivers(toks, collage);
        certain = qualifier?.kind === "ident" && toks[i - 3]?.text !== "." && receivers.has(qualifier.text);
      }
    }
    if (!kinds) continue;
    const { args } = callArgs(toks, i + 1);
    kinds.forEach((kind, k) => {
      const lit = args[k]?.[0];
      if (!kind || !isLiteral(lit)) return;
      const value = stringValue(lit);
      const closed = lit.text.length > 1 && lit.text.endsWith(lit.text[0]) && value !== undefined;
      // `"po" + "st"` is not a name the editor can know.
      if (closed && args[k].length !== 1) return;
      // An unterminated "…" runs to the end of its line, the line break included.
      const end = !closed && /[\r\n]$/.test(lit.text) ? lit.end - 1 : lit.end;
      const arg: GoNameArg = { call: t.text, kind, value: value ?? go.slice(lit.start + 1, end), start: lit.start, end, closed, certain };
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
 * before it. Nor where the call may be another package's.
 */
export function unknownGoName(inspection: Inspection, arg: GoNameArg, declared: Set<string> = new Set()): string | undefined {
  if (!arg.certain || !arg.closed || arg.value === "" || declared.has(arg.value)) return undefined;
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
