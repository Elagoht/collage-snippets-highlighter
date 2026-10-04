# Changelog

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
