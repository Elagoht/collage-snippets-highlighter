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
- **`plugins-config.json` validation**: completion, descriptions and a warning for
  a misspelt key, for all thirty-four published plugins.

## Snippets

### Go

| Prefix | |
| --- | --- |
| `cpage` | a page with a path and a content fragment |
| `cpagef` | a function returning a page with a layout |
| `cfrag` | a fragment |
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

By default this happens only in a collage project — a workspace whose `go.mod`
requires `github.com/Elagoht/collage`. The `collage.completions` setting makes it
`always` or `never`. Snippets and highlighting are always on.

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
npm run package     # builds collage-snippets-highlighter-<version>.vsix
code --install-extension collage-snippets-highlighter-0.1.0.vsix
```

The catalog tests read the collage and plugin sources from `~/Desktop` (or
`COLLAGE_SRC`) and skip when they are not there.
