# Collage Snippets & Highlighter

Snippets, template highlighting, completion and configuration validation for
[collage](https://collage.furkanbaytekin.dev), the Go framework for server-rendered
pages — for collage's own template functions and those of its
[published plugins](https://collage.furkanbaytekin.dev/en/docs/plugins/).

- **Snippets** for Go (`cpage`, `cfragd`, `caction`, `cplugin` …) and for templates
  (`clayout`, `cslot`, `cform`, `clive` …).
- **Highlighting** of `{{ … }}` inside HTML: collage's functions, the plugins'
  functions and Go's own builtins in their own colours, fields, variables, strings
  and pipes too — in attribute values as well as text.
- **Emmet, tag completion and formatting keep working**: templates stay HTML files.
- **Completion and hover** inside `{{ … }}` for every template function, with its
  signature and documentation, and for collage-live's `data-collage-*` attributes.
- **Names from your project**: page names in `{{pageURL "…"}}` and their
  parameters, fragments in `{{fragmentURL "…" "…"}}`, the slots a template has in
  `{{slot "…"}}`, mounted files in `{{asset "…"}}` — and a warning for a page or a
  file that does not exist, and go-to-definition from a name to the Go code
  declaring it.
- **Every plugin you depend on**, published or not: its `collage.json` adds its
  template functions, attributes, snippets and configuration schema.
- **`plugins-config.json` validation**: completion, descriptions and a warning for
  a misspelt key, for all thirty-four published plugins and any plugin with a
  `collage.json`.

## Snippets

### Go

| Prefix | |
| --- | --- |
| `cpage` | a page with a path and a content fragment |
| `cfrag` | a fragment |
| `cinline` | an inline fragment — its template in the Go string |
| `cfragd` | a fragment with a data handler returning data and tags |
| `cfrags` | a fragment with a child bound into a slot |
| `cload` | a typed data handler, `collage.Load` |
| `ceffect` | a data handler that only declares things for the page |
| `ccached` | `collage.Cached`: shared across renders until a TTL or a tag |
| `conce` | `collage.Once`: fetched once per render |
| `caction` | a form action: 422 to refuse, a redirect to accept |
| `cdoc` | a document at the site's root |
| `creg` | register a page |
| `cinval` | invalidate tags |
| `cmw` | middleware with `app.Use` |
| `cplugin` | a plugin skeleton |
| `cbefore`, `cafter` | a plugin's BeforeRender and AfterRender hooks |

#### Functions

These write a whole function, and bring what the file needs above it: in a file
with no `package` clause they add one — the package the other `.go` files beside
it declare, `main` beside `go.mod`, otherwise the directory's name as an
identifier (`auth-layout` → `authlayout`) — and they add the imports the function
uses that the file lacks. A file that has its package and imports is left as it
is. They are offered in collage projects (see `collage.completions`).

| Prefix | |
| --- | --- |
| `cpagef` | a function returning a page in a layout chain (`WithLayouts`) |
| `cfragf` | a function returning a fragment with a template file |
| `cinlinef` | a function returning an inline fragment |
| `clayoutf` | a function returning a layout, with `WithTitle` |
| `cguardf` | a guard: `nil` lets the request through, a decision redirects or refuses it |

### Templates

| Prefix | |
| --- | --- |
| `clayout` | a layout: the head where hoisted content lands, the content slot |
| `cslot`, `choist` | `{{slot}}`, `{{hoist}}` |
| `casset`, `ccss`, `cjs` | a mounted file's URL, a hoisted stylesheet, a script tag |
| `clink`, `curl`, `cfurl` | a link by page name, `{{pageURL}}`, `{{fragmentURL}}` |
| `clang` | a language switcher with `{{localeURL}}` |
| `cform` | a form posting to an action, with its forgery token |
| `cif`, `cife`, `crange`, `cwith`, `cdefine`, `ccomment` | Go template control structures |
| `clive`, `cliveclient` | collage-live: an element kept current, the client |
| `cflash` | collage-flash: the messages after a redirect |
| `ct`, `ctn` | collage-i18n: a translation, a plural |
| `cfield` | collage-validate: an input with its error and its value kept |
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

In Go, the template of an inline fragment is coloured the same way: the Go string
after `collage.NewInlineFragment("name", ` is HTML, with its `{{ … }}` actions in
collage's colours. So is the string of a constant or variable declared as
`collage.InlineHTML` (collage v0.30.0), which holds a template apart from its call:

```go
const loginForm collage.InlineHTML = `
  <form method="post">{{csrfToken}}</form>`
```

The name, or the declaration, and the opening backtick must be on one line, as the
snippets write them; other strings stay Go strings. Snippets and completions of
template functions work in HTML files only, not inside these strings.

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
| `collage.inspect` | `true` | run `go run . collage-inspect` to learn the project |
| `collage.diagnostics` | `warning` | how a name that does not exist is reported, or `off` |
| `collage.goCommand` | `go` | the go command to run |

## Names from your project

The extension asks the application what it is made of: in every folder whose
`go.mod` requires collage it runs `go run . collage-inspect` (collage v0.27.0 or
later, which a scaffolded `main.go` answers), and again whenever a Go file is saved.
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
npm test            # builds the grammar, compiles, and runs the grammar and catalog tests
npm run test:integration  # runs the extension in a VS Code of its own and checks completion and hover
npm run schema      # regenerates schemas/plugins-config.schema.json from ~/Desktop/collage-*
                    # (-manifests also writes each plugin repo's collage.json)
npm run package     # builds collage-snippets-highlighter-<version>.vsix
code --install-extension collage-snippets-highlighter-0.2.0.vsix
```

The catalog tests read the collage and plugin sources from `~/Desktop` (or
`COLLAGE_SRC`) and skip when they are not there.
