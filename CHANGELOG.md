# Changelog

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
