# Collage Snippets & Highlighter

Snippets, template highlighting, completion and configuration validation for
[collage](https://collage.furkanbaytekin.dev), the Go framework for server-rendered
pages — for collage's own template functions and those of its
[published plugins](https://collage.furkanbaytekin.dev/en/docs/plugins/).

- **Snippets** for Go, in the layout `collage new` scaffolds (`cpage`, `cfrag`, `cact`, `cactf` …), and for templates
  (`clayout`, `cslot`, `cform`, `clive` …).
- **Highlighting** of `{{ … }}` inside HTML: collage's functions, the plugins'
  functions and Go's own builtins in their own colours, fields, variables, strings
  and pipes too — in attribute values as well as text.
- **Emmet, tag completion and formatting keep working**: templates stay HTML files.
- **HTML inside Go edited as HTML**: the template of an inline fragment gets tag
  and attribute completion, your HTML snippets, Emmet, hover, folding, the
  matching tag, tags closed as you type them — and collage's completion,
  checks and go-to-definition in its `{{ … }}`.
- **Completion and hover** inside `{{ … }}` for every template function, with its
  signature and documentation, and for collage-live's `data-collage-*` attributes.
- **Names from your project**: page names in `{{pageURL "…"}}` and their
  parameters, fragments in `{{fragmentURL "…" "…"}}`, the slots a template has in
  `{{slot "…"}}`, mounted files in `{{asset "…"}}` — and a warning for a page or a
  file that does not exist, and go-to-definition from a name to the Go code
  declaring it.
- **Your data's fields**: `{{.` completes the fields and methods of the type the
  template's fragment renders, through `.Author.`, `{{range}}`, `{{with}}` and
  variables, and a name the data does not have is underlined.
- **Every plugin you depend on**, published or not: its `collage.json` adds its
  template functions, attributes, snippets and configuration schema.
- **`plugins-config.json` validation**: completion, descriptions and a warning for
  a misspelt key, for all thirty-four published plugins and any plugin with a
  `collage.json`.

## Snippets

### Go

Every Go snippet brings what the file needs to compile: its package clause when it
has none, and the imports it lacks. They follow the layout `collage new` scaffolds
and `collage add` writes — `pages/<area>/` builds a page, `fragments/pages/<area>/`
its content, `fragments/layouts/` the layouts, `actions/<area>.go` the actions and
`actions/funcs/<area>.go` their handlers. Exported functions come with a one-line
comment, a signature of several parameters takes a line for each, and data is a
typed view, never `any`. Placeholders name what goes in them — `name`, `Name`,
`service`, `*domain.Service`, `slot`, `id` — and one typed once fills every place
the snippet repeats it.

| Prefix | |
| --- | --- |
| `cpage`, `cpagea`, `cpagep`, `cpage404` | a page; with its form's action (`WithActionFor`); at a path with a `{parameter}`; the not-found page |
| `cfrag` | a page's content: an inline template, its view struct, a typed `collage.Load` handler |
| `cfragf`, `cfragd`, `cfrags`, `cfrag404` | a fragment with a template file; whose handler takes a service; with a slot filled per render; the not-found content |
| `chtml`, `cload`, `cstate` | a `collage.InlineHTML` constant; a typed data handler for `WithData`; a `collage.Key` for a value shared within a render |
| `clayout`, `clayoutg` | a layout; a layout with a guard |
| `cguard` | a guard: `nil` lets the request through, a decision redirects |
| `cact`, `cactp` | an action builder: attached to its page; at a URL of its own |
| `cactf`, `cactj`, `cactr` | an action handler: a validated form with a flash and a redirect; JSON that invalidates tags; the page rendered again |
| `cval`, `cvf`, `cvfail`, `cvfields` | collage-validate: check a form; one field's rule; refuse for the handler's reason; refuse with a service's messages by field |
| `cflash`, `credir`, `ccookie` | collage-flash's message; a redirect by page name; a redirect setting a cookie |
| `cparam`, `cnotfound` | an integer route parameter; a missing record as a 404 |
| `cmeta`, `cjsonld` | collage-meta: title, description, canonical; collage-jsonld: an Article |
| `cdoc`, `cdocs` | a document rendered by a handler; one with a fixed body at the site's root |
| `cservice`, `cerrs` | `data/<domain>`: a service; its errors and the form field each is shown beside |
| `creg` | `routes.go`'s `register`: one `app.Register` call and the not-found page |
| `ccached`, `conce`, `cinval` | `collage.Cached` and `collage.Once`, under a `collage.Key`; an action's `InvalidateTags` |
| `cmw` | middleware with `app.Use` |
| `ctest`, `ctestf` | collagetest: a page renders; a form submitted with its token, and where it redirects |
| `cplugin`, `chook` | a plugin skeleton; its AfterRender or BeforeRender hook |

### Templates

| Prefix | |
| --- | --- |
| `clayout` | a layout: the head where hoisted content lands, the content slot |
| `cslot`, `choist` | `{{slot}}`, `{{hoist}}` |
| `casset`, `ccss`, `cjs` | a mounted file's URL, a hoisted stylesheet, a script tag |
| `clink`, `curl`, `curlp`, `cfurl` | a link by page name, `{{pageURL}}`, with a parameter, `{{fragmentURL}}` |
| `clang` | a language switcher with `{{localeURL}}` |
| `cform` | a form posting to an action, with its forgery token |
| `cformv` | a form collage-validate checks: a field, the form's own message, the token and a honeypot |
| `caform`, `caurl` | a form posting to an action by name, `{{actionURL}}` |
| `crangelink` | a list of links to a page with a parameter, and what shows when there is none |
| `cif`, `cife`, `crange`, `cwith`, `cdefine`, `ccomment` | Go template control structures |
| `clive`, `cliveclient` | collage-live: an element kept current, the client |
| `cflash`, `cflasht` | collage-flash: the messages after a redirect; as toasts that remove themselves |
| `ct`, `ctn` | collage-i18n: a translation, a plural |
| `cfield`, `cfieldt`, `cferr` | collage-validate: an input, a textarea, the form's own message |
| `choney` | collage-honeypot |
| `cnonce` | collage-secure: an inline script allowed by the CSP |
| `ctoc`, `csearch`, `ccode`, `cbundle` | collage-toc, collage-search, collage-highlight, collage-bundle |

Emmet's abbreviations work beside them, since templates are still HTML.

## Highlighting

The template grammar is injected into HTML rather than defining a language of its
own. A template keeps everything VS Code does for HTML — Emmet, tag completion,
formatting — and `{{ … }}` gets its own colours on top. The one cost: other HTML
files in the same editor that use `{{ }}` for something else, such as Angular
templates, are coloured as Go templates too.

In Go, the template of an inline fragment is coloured the same way: the raw
string among `collage.NewInlineFragment`'s arguments is HTML, with its `{{ … }}`
actions in collage's colours, and its `<script>` and `<style>` in JavaScript's and
CSS's. So is the string of a constant or variable declared as
`collage.InlineHTML` (collage v0.30.0), which holds a template apart from its call:

```go
const formBlock collage.InlineHTML = `
  <form method="post">{{csrfToken}}</form>`
```

The arguments may be on lines of their own, and a declaration's string may start
on the line after its `=`. Other strings stay Go strings.

Your theme colours the scopes; to give collage's functions a colour of their own:

```json
"editor.tokenColorCustomizations": {
  "textMateRules": [
    { "scope": "support.function.collage.core", "settings": { "foreground": "#e4572e" } },
    { "scope": "support.function.collage.plugin", "settings": { "foreground": "#f3b61f" } }
  ]
}
```

| Scope | |
| --- | --- |
| `support.function.collage.core` | collage's functions: `slot`, `asset`, `pageURL` … |
| `support.function.collage.plugin` | the plugins' functions: `t`, `flashes`, `cspNonce` … |
| `support.function.builtin.collage-template` | Go's builtins: `eq`, `len`, `printf` … |
| `keyword.control.collage-template` | `if`, `range`, `with`, `end` … |
| `variable.other.member.collage-template` | fields: `.Title` |
| `variable.other.collage-template` | variables: `$post` |
| `punctuation.section.embedded.begin/end.collage-template` | `{{`, `}}` |

## HTML inside Go

Inside an inline template, the editing is an HTML file's:

- **Completion** of tags and attributes, and **your HTML snippets** — the ones you
  wrote, this extension's, other extensions' — as VS Code offers them in HTML.
  Go's snippets are not offered there.
- **Emmet**: `ul>li*3` is offered as its expansion, first in the list.
- **Tags closed as you type** `>`, and `</` completed, following
  `html.autoClosingTags`.
- **Hover**, **folding** — every element, and `<!-- #region -->` sections — and
  **the matching tag** highlighted.
- **Both names of a tag pair edited as one**, with `editor.linkedEditing` on, as
  in an HTML file.
- **collage's own**: template functions completed and described inside
  `{{ … }}`, page and action names in their arguments, a warning for a name the
  application does not have, and go-to-definition.

It works on a copy of the Go file that keeps only its HTML, the rest blanked out,
so every position is the same in both: VS Code's HTML support answers for the
copy, and the answer is shown in the Go file. The Go around the template is left
to Go — its folding and gopls's are merged.

## Completion and hover

Inside `{{ … }}` completion offers collage's functions first, then the plugins',
then Go's builtins, each inserting its arguments as placeholders; hovering one shows
its signature, what it does and a link to its documentation. In a tag it offers
collage-live's `data-collage-*` attributes.

By default this happens only in a collage project — a folder whose `go.mod`
requires `github.com/Elagoht/collage`. The `collage.completions` setting makes it
`always` or `never`. Snippets and highlighting are always on.

| Setting | Default | |
| --- | --- | --- |
| `collage.completions` | `auto` | where completion and hover are offered |
| `collage.inspect` | `true` | build the project and run `collage-inspect` to learn it |
| `collage.diagnostics` | `warning` | how a name that does not exist is reported, or `off` |
| `collage.goCommand` | `go` | the go command to run |

## Names from your project

The extension asks the application what it is made of: in every folder whose
`go.mod` requires collage it builds the program with `go build -tags collage_dev`
into a temporary file and runs it with `collage-inspect` and `COLLAGE_DEV=1`
(collage v0.27.0 or later, which a scaffolded `main.go` answers), and again whenever
a Go file is saved. The tag and the temporary file keep the Go build cache from
gaining a copy of your templates and static files with every save, as `go run`
would.
The status bar shows what it learnt — `collage: 12 pages` — and a click refreshes it;
the Collage output channel says why when it could not.

With that it completes, in string arguments:

| Where | What |
| --- | --- |
| `pageURL "…"`, `pageURLIn "tr" "…"` | pages and documents, then the route's parameter names |
| `fragmentURL "…" "…"` | pages with fragment paths, then their fragments, then parameters |
| `localeURL "…"` | the locales |
| `slot "…"` | the slots of the fragment rendering this template |
| `asset "…"`, `stylesheet "…"` | the files the mounts serve |

It warns about a page, a fragment or a file that does not exist — not about a slot:
a template calling `{{slot "x"}}` declares `x`, and one nothing fills renders empty.
F12 on a page name opens the `NewPage("…")` that declares it; on a slot, the binding;
on an asset, the file.

Running the application's `main` builds the application without serving it. A
program that connects to a database while it builds would do so here too; turn it
off with `"collage.inspect": false`, and completion falls back to the functions it
knows.

## Your data's fields

From collage v0.49.0 the inspection says what type each fragment's data is —
`WithData(collage.Load(loadPost))` with `loadPost` returning `blog.Post` — and
the fields and methods of every type it reaches. In a template a fragment renders,
and in the inline template of a `NewInlineFragment`, the extension completes:

| Where | What |
| --- | --- |
| `{{.‸`, `{{.Author.‸` | the fields and methods of the data, pointers followed |
| `{{range .Comments}}{{.‸` | the element's, and `$i, $v :=` typed as index and element (key and value for a map) |
| `{{with .Author}}{{.‸` | the value's; `{{else}}` goes back to the outer dot |
| `{{$v.‸`, `{{$.‸` | a variable's, the template's data |
| `{{$‸` | the variables in reach |
| `{{.Tags.key.‸` | a `map[string]V`'s value, a named map's too |
| `WithSlotFragment("‸"` | in Go: the slots the parent fragment's template calls |

When one template is rendered by fragments of different types, it offers every
type's names, saying which have each one, and warns only about a name none of
them has. A warning reads as the startup check would put it:
`type blog.Post has no field or method Titel (did you mean Title?)`. The same goes
for `WithSlotFragment` and `WithSlotResolver` binding into a slot the parent's
template never calls. These are always warnings, never errors: collage's own check
when the application starts is the authority, and the editor is early feedback,
quieter than it, never noisier. So nothing is reported where the type is not
known for certain:

- a fragment with no data, a data type the inspection could not tell, or one
  built `WithoutTypeCheck()` — when one template serves several fragments, any one
  of them silences it;
- an interface (`any`), a `map[string]any`'s values, a type from the standard
  library (`time.Time`, `template.HTML`), anything below a template function's
  result or a parenthesised value;
- inside `{{define}}` and `{{block}}`, whose data is whatever invokes them;
- a type name two packages share (`ambiguous` in the inspection, collage
  v0.51.2);
- with collage before v0.51.1: a named container's (`type Posts []Post`) element,
  which that inspection does not say — its methods still complete — and a
  struct's embedded field (`{{.Base.ID}}`), which it does not list, so a name any
  struct in the project embeds is never reported;
- a partial reached only through `{{template "…" .X}}`: no fragment renders it, so
  it gets neither completion nor warnings;
- a slot binding whose template calls a slot by a computed name or includes
  another template, or whose parent is not built in the same expression or from a
  variable assigned from `NewFragment` earlier in the same function; a parent
  known only by a name several fragments with different templates share.

A template file is matched to its fragments by its exact path under the template
directory: the inspection's `templateRoot`, or, when the fragments' templates are
not there (`os.DirFS("templates")` with `Root: "."`), the directory below the
project they are found under.

What it knows is the last successful inspection. The warnings about fields
pause while the application does not build or start — a compile error, or a type
error the startup check rejects — while an inspection is under way, and while a
Go file of the project has unsaved changes outside its inline templates: the type
table may be the one from before the very change being made. Completion keeps
using what it knew. Saving a Go file inspects again (a save during an inspection
is inspected after it), and so does saving a template while the last inspection
failed.

## Plugins' collage.json

A plugin module can describe itself in a `collage.json` at its root — the format is
in collage's plugin guide, and `schemas/collage-plugin-manifest.schema.json` here
validates it. The extension finds every one in the project's module graph
(`go list -m -json all`) and offers its template functions with their
documentation, its attributes and snippets, and adds its configuration to
`plugins-config.json`'s schema. The published plugins ship one; so can yours.

## plugins-config.json

The file a collage application loads with `collage.LoadPluginConfig` is validated
against a schema generated from the plugins' own source: each plugin's key, its
options, their types, their allowed values and the comments that document them. A
key the schema does not know under a published plugin is flagged; a plugin that is
not published — your own — is accepted under its own key.

## Kept current

One catalog, `data/catalog.json`, lists every template function; the grammar,
completion and hover are built from it. The tests check it against collage's
`DefaultFuncs` and against every function the published plugins register, and the
schema is generated from the plugins' source (`npm run schema`), so neither can
quietly fall behind.

## Development

```sh
npm install
npm test            # builds the grammar, compiles, and runs the grammar and catalog tests,
                    # and go vet on every Go snippet against test/compile/go.mod's collage
npm run test:integration  # runs the extension in a VS Code of its own and checks completion and hover
npm run schema      # regenerates schemas/plugins-config.schema.json from ~/Desktop/collage-*
                    # (-manifests also writes each plugin repo's collage.json)
npm run package     # builds collage-snippets-highlighter-<version>.vsix
code --install-extension collage-snippets-highlighter-0.2.0.vsix
```

The catalog tests read the collage and plugin sources from `~/Desktop` (or
`COLLAGE_SRC`) and skip when they are not there. The snippet check needs `go`,
and the network once, to fill the module cache; it skips without `go`.
