package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// plugin writes a one-file plugin named name, reading its configuration as
// plugins have since collage v0.50.0, into a fresh directory and parses it.
func plugin(t *testing.T, name, body string) (*pkg, error) {
	t.Helper()
	return pluginReading(t, name, "func (p *Plugin) Configure(host ConfigHost) (err error) {\n\tp.cfg, err = collage.PluginConfig(host, p.cfg)\n\treturn err\n}", body)
}

// pluginReading is plugin with configure as the method reading the configuration.
func pluginReading(t *testing.T, name, configure, body string) (*pkg, error) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "collage-"+strings.TrimPrefix(name, "elagoht/"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	src := "package p\n\nconst Name = \"" + name + "\"\n\n" +
		configure + "\n\n" + body
	if err := os.WriteFile(filepath.Join(dir, "p.go"), []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	return parse(dir)
}

func property(t *testing.T, p *pkg, key string) string {
	t.Helper()
	s := p.schema()
	if len(p.errs) > 0 {
		t.Fatalf("schema: %v", p.errs)
	}
	body, err := json.Marshal(s.Properties[key])
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

// A type that decodes itself takes whatever its UnmarshalJSON reads, which its
// underlying Go type does not say: opti-image's WebPMode is a uint8 read from
// true, false or "auto".
func TestATypeThatDecodesItselfIsDescribedByItsDecoder(t *testing.T) {
	p, err := plugin(t, "elagoht/opti-image", `
type Config struct {
	WebP WebPMode `+"`json:\"webp\"`"+`
	FetchTimeout Duration `+"`json:\"fetchTimeout\"`"+`
}
type WebPMode uint8
func (m *WebPMode) UnmarshalJSON(data []byte) error { return nil }
type Duration int64
func (d *Duration) UnmarshalJSON(data []byte) error { return nil }
`)
	if err != nil {
		t.Fatal(err)
	}
	if got := property(t, p, "webp"); !strings.Contains(got, `"anyOf":[{"type":"boolean"},{"type":"string","enum":["auto"]}]`) {
		t.Errorf("webp = %s, want true, false or \"auto\"", got)
	}
	if got := property(t, p, "fetchTimeout"); !strings.Contains(got, `"anyOf":[{"type":"string"`) || !strings.Contains(got, `{"type":"integer"`) {
		t.Errorf("fetchTimeout = %s, want a duration string or nanoseconds", got)
	}
}

// A decoder the generator has no entry for stops it: guessing from the Go type
// is how webp came to be an integer.
func TestAnUnknownDecoderIsAnError(t *testing.T) {
	p, err := plugin(t, "elagoht/newone", `
type Config struct {
	Mode Mode `+"`json:\"mode\"`"+`
}
type Mode int
func (m *Mode) UnmarshalJSON(data []byte) error { return nil }
`)
	if err != nil {
		t.Fatal(err)
	}
	p.schema()
	if len(p.errs) != 1 || !strings.Contains(p.errs[0].Error(), "elagoht/newone.Mode") {
		t.Errorf("errs = %v, want one naming elagoht/newone.Mode", p.errs)
	}
}

// A type without its own decoder is what encoding/json makes of it.
func TestATypeWithoutADecoderIsItsUnderlyingType(t *testing.T) {
	p, err := plugin(t, "elagoht/plain", `
type Config struct {
	Wait Duration `+"`json:\"wait\"`"+`
}
type Duration int64
`)
	if err != nil {
		t.Fatal(err)
	}
	if got := property(t, p, "wait"); !strings.Contains(got, `"type":"integer"`) {
		t.Errorf("wait = %s, want an integer: nothing reads \"2s\" for it", got)
	}
}

// A plugin written before collage v0.50.0 decoded its configuration with
// host.Config; its Config is still its schema.
func TestHostConfigStillCounts(t *testing.T) {
	p, err := pluginReading(t, "elagoht/old", "func (p *Plugin) Configure(host Host) error { return host.Config(&p.cfg) }", `
type Config struct {
	Name string `+"`json:\"name\"`"+`
}
`)
	if err != nil {
		t.Fatal(err)
	}
	if got := property(t, p, "name"); !strings.Contains(got, `"type":"string"`) {
		t.Errorf("name = %s, want a string", got)
	}
}

// A plugin that reads no configuration has no schema: its Options are Go-only.
func TestAPluginReadingNoConfigurationHasNoProperties(t *testing.T) {
	p, err := pluginReading(t, "elagoht/none", "", `
type Options struct {
	Name string
}
`)
	if err != nil {
		t.Fatal(err)
	}
	if s := p.schema(); len(s.Properties) != 0 {
		t.Errorf("properties = %v, want none", s.Properties)
	}
}
