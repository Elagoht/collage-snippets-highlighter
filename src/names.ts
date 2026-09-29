// Which names are valid where: the page names pageURL takes, the action names
// actionURL takes, the fragments of a
// page fragmentURL takes, the slots a template fills, the files asset serves —
// from what collage-inspect reported. Completion offers them; diagnostics check
// against them.
import type { Inspection } from "./project";
import type { Call } from "./template";

export interface Name {
  label: string;
  detail?: string;
}

/** What an argument position holds, and the names valid there; undefined when nothing is known. */
export function namesFor(inspection: Inspection, templateName: string | undefined, call: Call, index: number): { what: string; names: Name[] } | undefined {
  const arg = (i: number) => call.args[i]?.value ?? "";
  switch (call.name) {
    case "pageURL":
      return index === 0 ? routes(inspection) : params(inspection, arg(0), index - 1);
    case "pageURLIn":
      if (index === 0) return locales(inspection);
      return index === 1 ? routes(inspection) : params(inspection, arg(1), index - 2);
    case "actionURL":
      return index === 0 ? actions(inspection) : actionParams(inspection, arg(0), index - 1);
    case "localeURL":
      return index === 0 ? locales(inspection) : undefined;
    case "fragmentURL":
      return fragmentURL(inspection, arg(0), index, arg(1));
    case "fragmentURLIn":
      return index === 0 ? locales(inspection) : fragmentURL(inspection, arg(1), index - 1, arg(2));
    case "slot":
      return index === 0 ? slots(inspection, templateName) : undefined;
    case "asset":
      return index === 0 ? files(inspection, () => true) : undefined;
    case "stylesheet":
      return index === 0 ? files(inspection, (f) => f.endsWith(".css")) : undefined;
    case "hoist":
      return index === 0 ? { what: "hoist area", names: [{ label: "head", detail: "the document's <head>" }] } : undefined;
  }
  return undefined;
}

function routes(inspection: Inspection): { what: string; names: Name[] } {
  const names: Name[] = [];
  for (const p of inspection.pages) names.push({ label: p.name, detail: "page " + Object.values(p.paths).join(", ") });
  for (const d of inspection.documents) names.push({ label: d.name, detail: "document " + Object.values(d.paths).join(", ") });
  return { what: "page or document", names };
}

function params(inspection: Inspection, route: string, index: number): { what: string; names: Name[] } | undefined {
  // Pairs of name and value: only a name position has a known set.
  if (index % 2 !== 0) return undefined;
  const found = inspection.pages.find((p) => p.name === route) ?? inspection.documents.find((d) => d.name === route);
  if (!found) return undefined;
  return { what: `parameter of ${route}`, names: (found.params ?? []).map((p) => ({ label: p, detail: `{${p}}` })) };
}

function actions(inspection: Inspection): { what: string; names: Name[] } {
  return { what: "action", names: (inspection.actions ?? []).map((a) => ({ label: a.name, detail: `${a.methods.join(", ")} ${Object.values(a.paths).join(", ")}` })) };
}

function actionParams(inspection: Inspection, action: string, index: number): { what: string; names: Name[] } | undefined {
  if (index % 2 !== 0) return undefined;
  const found = (inspection.actions ?? []).find((a) => a.name === action);
  if (!found) return undefined;
  // Inspection lists an action's patterns, not its parameters: read them off.
  const names = new Set<string>();
  for (const pattern of Object.values(found.paths)) for (const m of pattern.matchAll(/\{([^}.]+)(?:\.\.\.)?\}/g)) names.add(m[1]);
  return { what: `parameter of ${action}`, names: [...names].map((p) => ({ label: p, detail: `{${p}}` })) };
}

function locales(inspection: Inspection): { what: string; names: Name[] } {
  return { what: "locale", names: inspection.locales.map((l) => ({ label: l, detail: l === inspection.defaultLocale ? "default locale" : "locale" })) };
}

function fragmentURL(inspection: Inspection, page: string, index: number, fragment: string): { what: string; names: Name[] } | undefined {
  const withPaths = inspection.pages.filter((p) => p.fragmentPaths?.length);
  if (index === 0) return { what: "page with fragment paths", names: withPaths.map((p) => ({ label: p.name, detail: `${p.fragmentPaths!.length} fragment path(s)` })) };
  const found = withPaths.find((p) => p.name === page);
  if (!found) return undefined;
  if (index === 1) {
    const seen = new Map<string, string>();
    for (const fp of found.fragmentPaths!) if (!seen.has(fp.fragment)) seen.set(fp.fragment, fp.pattern);
    return { what: `fragment of ${page}`, names: [...seen].map(([label, pattern]) => ({ label, detail: pattern })) };
  }
  if ((index - 2) % 2 !== 0) return undefined;
  const fp = found.fragmentPaths!.find((f) => f.fragment === fragment);
  return fp ? { what: `parameter of ${page}/${fragment}`, names: (fp.params ?? []).map((p) => ({ label: p, detail: `{${p}}` })) } : undefined;
}

function slots(inspection: Inspection, templateName: string | undefined): { what: string; names: Name[] } | undefined {
  const mine = templateName ? inspection.fragments.filter((f) => f.template === templateName) : [];
  // A template no registered fragment renders: every slot anyone has, as a hint,
  // but nothing to check against.
  const source = mine.length ? mine : inspection.fragments;
  const names = new Map<string, string>();
  for (const f of source) for (const s of f.slots ?? []) names.set(s, `slot of ${f.name}`);
  return { what: mine.length ? `slot of ${mine.map((f) => f.name).join(", ")}` : "slot", names: [...names].map(([label, detail]) => ({ label, detail })) };
}

function files(inspection: Inspection, keep: (f: string) => boolean): { what: string; names: Name[] } {
  const names: Name[] = [];
  for (const m of inspection.mounts) for (const f of m.files) if (keep(f)) names.push({ label: f, detail: `mounted at ${m.prefix}` });
  return { what: "mounted file", names };
}

/**
 * Whether a literal argument names nothing: a page that does not exist, a file no
 * mount serves. Only where the set is known for certain. A slot never is: a
 * template calling {{slot "x"}} declares x, and one nothing fills renders empty.
 */
export function unknownName(inspection: Inspection, templateName: string | undefined, call: Call, index: number): string | undefined {
  const arg = call.args[index];
  if (!arg?.isString || arg.value === "" || call.name === "slot" || call.name === "hoist") return undefined;
  // A parameter's name is checked; its value is anything.
  const known = namesFor(inspection, templateName, call, index);
  if (!known || known.names.length === 0) return undefined;
  if (known.names.some((n) => n.label === arg.value)) return undefined;
  return `No ${known.what} named "${arg.value}".`;
}
