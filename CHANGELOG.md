# Changelog

## 0.11.0

- **`plugins-config.json` knows `elagoht/health`** (collage-health v0.1.0):
  `livePath`, `readyPath`, `checkTimeout`, `cacheFor`, `details` and
  `maxInFlight` complete and are checked; the two durations take `"2s"` or a
  number of nanoseconds.
- **`elagoht/deploy`'s `target` completes its values** (collage-deploy v0.1.1's
  typed constants): `cloudflare`, `github-pages`, `netlify`, `vercel`, or empty.
- Schema regenerated from the latest release of every plugin, against collage
  v0.53.0. No template functions were added in collage v0.53.0 or by any plugin,
  so the catalog and snippets are unchanged.

## 0.10.0

- **`plugins-config.json` knows `elagoht/deploy`** (collage-deploy v0.1.0): its
  `target` key, the static host to write configuration files for, completes and
  is checked.
- **collage-redirects v0.2.0**: `noRedirectsFile` is gone from the schema, so it
  is flagged as an unknown key.
- Schema regenerated from the latest release of every plugin, against collage
  v0.52.0. No template functions were added in collage v0.52.0, so the catalog
  and snippets are unchanged.

## 0.9.0

- **Your data's fields complete in templates.** With collage v0.49.0 or later,
  `{{.` offers the fields and methods of the type the template's fragment renders
  — its file, or the inline template of a `NewInlineFragment` — following
  `.Author.Name` through pointers, `{{range}}` into the element (`$i, $v :=`
  typed), `{{with}}` into the value, variables and `$`. A template several
  fragments render offers every type's names, marked with which have them.
- **A field the data does not have is a warning**, as the startup check would
  word it, with the closest name: `type blog.Post has no field or method Titel
  (did you mean Title?)`. Only where the type is certain: never on a fragment
  with no data or an unknown type, an interface, a `map[string]any`, a template
  function's result, a `{{define}}`, or a name some struct embeds; for a
  template several fragments render, only a name none of them has. Never an
  error, whatever `collage.diagnostics` says.
- **Requires collage v0.49.0 or later** for the data's types (older inspections
  have none, and nothing changes there), and **v0.51.1 or later** for named
  containers, named maps and named pointers — followed through the table's `elem`
  and `key` — and embedded fields (`{{.Base.ID}}`); before it, a range over a
  named container is unknown and the names the project's structs embed are never
  reported. A type name two packages share (`ambiguous`, v0.51.2) is unknown.
- Identifiers in any script (`{{.Başlık}}`, `$ş`) are read as Go reads them.
- The field warnings pause while the type table may be out of date: from a Go
  file's save — or any change on disk, a git checkout — until its inspection
  lands, while an inspection fails, and while Go code has unsaved changes.
- **`WithSlotFragment("` completes** the slots the parent fragment's template
  calls, and `WithSlotFragment` or `WithSlotResolver` binding into one it never
  calls is a warning.

## 0.8.0

- **The snippets' placeholders name what goes in them**, not an example
  application: `${1:name}` for the name a page, fragment or action is
  registered under, `${2:Name}` for its Go function, `${3:service}`
  `${4:*domain.Service}` for a dependency, `slot`, `id`, `tag`, `field`,
  `layouts.Layout()`. Before, they were one application's — stories, users, a
  login, an entry area — in the Go snippets and in `curlp`, `crangelink`,
  `cformv`, `caform`, `cfield` and `cfieldt`. A name typed once still fills
  every place the snippet repeats it.
- **The Go snippets follow collage v0.49.0 and v0.50.0.** A fragment's data is
  `WithData(collage.Load(…))`, and `cfragd`'s handler factory returns
  `collage.Data` (`WithDataHandler` and `DataHandlerFunc` are gone). `cstate`
  declares a typed `collage.Key`, read and written with `Get` and `Set`;
  `ccached` and `conce` take a key. `cplugin` reads its options with
  `collage.PluginConfig(host, defaults)`.
- Every Go snippet is now compiled in the tests: `go vet` against collage v0.50.0
  and collage-validate, -flash, -meta and -jsonld, every choice tried. The
  template snippets are checked to call only functions collage or a plugin has.
- plugins-config.json: the schema knows fail2ban. The generator finds a plugin's
  options through `collage.PluginConfig` as well as `host.Config`; without it,
  plugins on collage v0.50.0 would have lost their schema.

## 0.7.0

- **Learning the project no longer fills the Go build cache.** It ran
  `go run . collage-inspect` on every save of a Go file, and `go run` keeps the
  linked program in the Go build cache, with the embedded `templates/` and
  `static/` inside both it and the compiled main package: two more copies of
  them per save, kept for five days — 67 MB a save with a 30 MB `static/`. It
  now builds the way `collage dev` does since collage v0.46.0,
  `go build -tags collage_dev` into a temporary file, and runs that with
  `COLLAGE_DEV=1`, so the templates and static files are read from disk. A
  project whose `main.go` still has the `//go:embed` lines keeps one copy a save
  until it moves them into `embed.go`; `collage dev` says how. Running in
  development mode also stops it leaving a `.cache/<hash>` directory of rendered
  pages in the project with every save, and lets a plugin that needs production
  settings only outside development, such as errortrack's DSN, be inspected.
- **The Go snippets are rewritten** for the layout collage v0.40.0 scaffolds and
  `collage add` writes: `pages/<area>`, `fragments/pages/<area>`,
  `fragments/layouts` with `Master()`, `actions/<area>.go` and their handlers in
  `actions/funcs/`. Each brings its package clause and imports, and is typed with
  a view struct. The prefixes are families: `cpage*`, `cfrag*`, `clayout*`,
  `cact*` (`cact`, `cactp`, `cactf`, `cactj`, `cactr`), `cdoc*`, `ctest*` — see
  the README. New: `cpagep`, `cfrag404`, `cvfields`, `cdocs`, `cservice`, `cerrs`,
  `ctest` and `ctestf` (collagetest), `chook`.
- **Renamed:** `cpagef` → `cpage`, `cinlinef` → `cfrag`, `clayoutf` → `clayout`,
  `cguardf` → `cguard`, `cactionf` → `cactf`, `cdataf` → `cfragd`, `cslotr` →
  `cfrags`, `c404f` → `cpage404`, `cregall` → `creg`, `cvalid` → `cval`,
  `cflashadd` → `cflash`, `credirect` → `credir`, `cbefore`/`cafter` → `chook`.
  The expression snippets that only built a value (`cpage`, `cfrag`, `cinline`,
  `caction`, …) are gone: every Go snippet writes a whole declaration or the lines
  of a handler.
- `curlp`: a page's URL with its `{parameter}` filled.
- `oauthLogin`, collage-oauth's: the path that signs the reader in with a
  provider, completed and coloured like the other plugin functions.
- plugins-config.json: the schema knows errortrack, oauth, ogimage and tenant, and
  takes the current settings and descriptions of cdnpurge, indexnow, meta, robots,
  secure and sitemap.

## 0.6.2

- `data-collage-transition`, collage-live v0.4.0's attribute: each answer goes in
  inside a view transition, unless the reader prefers reduced motion.
- plugins-config.json: `baseURL` in indexnow v0.1.3, meta v0.1.4 and sitemap
  v0.1.3 falls back to collage's `Config.BaseURL` when empty.

## 0.6.1

- plugins-config.json: i18n v0.2.0's `strict`, which refuses to start while the
  catalogs differ.

## 0.6.0

- HTML inside Go is edited as HTML is: completion of tags and attributes, your
  HTML snippets, Emmet, hover, folding, the matching tag, tags closed as they are
  typed and tag pairs renamed together — and collage's completion, name checks
  and go-to-definition in its `{{ … }}`.
- An inline template is coloured when `NewInlineFragment`'s arguments are on
  lines of their own, and when a declaration's string starts on the line after
  its `=`. Before, the name and the backtick had to be on the call's line.
- Snippets from a real application's patterns: `cpagea`, `cactionf`, `cvalid`,
  `cvf`, `cvfail`, `cflashadd`, `credirect`, `ccookie`, `cdataf`, `cmeta`,
  `cjsonld`, `cslotr`, `cstate`, `cnotfound`, `c404f`, `chtml`, `cregall`,
  `cparam` in Go, with the imports they use; `cformv`, `cfieldt`, `cferr`,
  `caform`, `caurl`, `crangelink`, `cflasht` in templates.
- plugins-config.json: opti-image's `webp` takes `true`, `false` or `"auto"` —
  it was checked as an integer, and every valid value was refused — and its
  `fetchTimeout`, like cdnpurge's durations, takes `"10s"` or nanoseconds. A
  type that decodes itself is described by what its decoder reads; the
  generator refuses one it has no description of. Regenerated from every
  plugin's latest release.

## 0.5.0

- `actionURL` (collage v0.36.0): highlighted and documented, with the project's
  action names offered and checked in its first argument, the parameters read
  off the action's patterns, and go-to-definition to its `NewAction`.

## 0.4.2

- elagoht/honeypot's configuration schema follows v0.3.0, which dropped
  `maxBody`: the action's own body limit is the one that applies.

## 0.4.1

- `honeypot` takes an optional delay in seconds (elagoht/honeypot v0.2.0), and
  its configuration schema says `minDelay` defaults to off and `protect` to no
  prefixes: the forms carrying `{{honeypot}}` say which paths are protected.

## 0.4.0

- The string of a `const` or `var` declared as `collage.InlineHTML` (collage
  v0.30.0) is coloured as HTML, with collage's template actions in it.

## 0.3.0

- Function snippets — `cpagef`, `cfragf`, `cinlinef`, `clayoutf`, `cguardf` —
  that add the file's `package` clause when it has none (the package of the
  files beside it, `main` beside `go.mod`, or the directory's name) and the
  imports the function uses that the file lacks.
- `cinline`: an inline fragment (collage v0.29.0).
- The template of `collage.NewInlineFragment("name", ` … `)` is coloured as HTML,
  with collage's template actions in it.
- `cpagef` writes `WithLayouts` (collage v0.28.0 removed `WithLayout`).

## 0.2.0

- Names from the project, learnt from `go run . collage-inspect` (collage
  v0.27.0): pages and their parameters in `pageURL`, fragments in `fragmentURL`,
  slots in `slot`, mounted files in `asset` and `stylesheet`, locales in
  `localeURL`.
- Warnings for a page, fragment or file that does not exist
  (`collage.diagnostics`).
- Go to definition from a page, fragment or slot name to the Go code declaring
  it, and from an asset to its file.
- Plugins' `collage.json` manifests, found through the module graph: their
  template functions, attributes, snippets, and configuration in
  `plugins-config.json`'s schema — for any plugin, published or not.
- A misspelt key under a published plugin in `plugins-config.json` is flagged; it
  was accepted before.
- A status bar item and the Collage output channel say what the extension knows.
- Settings: `collage.inspect`, `collage.goCommand`, `collage.diagnostics`.

## 0.1.0

- Snippets for Go and for collage templates, collage's plugins included.
- Highlighting of `{{ … }}` in HTML, injected into the HTML grammar so Emmet, tag
  completion and formatting keep working; collage's functions, the plugins' and
  Go's builtins in scopes of their own.
- Completion and hover for every template function and for collage-live's
  `data-collage-*` attributes, in collage projects by default.
- A JSON Schema for `plugins-config.json`, generated from the thirty-four
  published plugins' source.
