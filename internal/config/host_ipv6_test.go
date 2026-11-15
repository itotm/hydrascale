package config

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func TestHostIPv6DefaultsToTrueAndReadsFalse(t *testing.T) {
	dir := t.TempDir()
	for body, want := range map[string]bool{
		"version: 2\ntailnets:\n  - id: home\n":                   true,
		"version: 2\nhost_ipv6: true\ntailnets:\n  - id: home\n":  true,
		"version: 2\nhost_ipv6: false\ntailnets:\n  - id: home\n": false,
	} {
		path := filepath.Join(dir, "config.yaml")
		if err := os.WriteFile(path, []byte(body), 0644); err != nil {
			t.Fatal(err)
		}
		cfg, err := LoadConfig(path)
		if err != nil {
			t.Fatalf("LoadConfig(%q): %v", body, err)
		}
		if got := cfg.HostIPv6Enabled(); got != want {
			t.Errorf("HostIPv6Enabled() = %v for %q, want %v", got, body, want)
		}
	}
}

func TestLoadConfigRefusesAnUnknownHostDNSMode(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("version: 2\nhost_dns:\n  mode: resolve\ntailnets:\n  - id: home\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadConfig(path); err == nil {
		t.Fatal("LoadConfig accepted host_dns.mode: resolve")
	}
}

func TestValidateVethIndexesRefusesACollision(t *testing.T) {
	// Find two IDs with the same index.
	seen := map[int]string{}
	var a, b string
	for i := 0; a == ""; i++ {
		id := "t" + strconv.Itoa(i)
		idx := VethIndexFor(id)
		if other, ok := seen[idx]; ok {
			a, b = other, id
		}
		seen[idx] = id
	}
	if err := validateVethIndexes([]Tailnet{{ID: a}, {ID: b}}); err == nil {
		t.Fatalf("validateVethIndexes accepted %q and %q with the same index", a, b)
	}
	if err := validateVethIndexes([]Tailnet{{ID: "home"}, {ID: "work"}, {ID: "biblio"}}); err != nil {
		t.Fatalf("validateVethIndexes refused home, work, biblio: %v", err)
	}
}
