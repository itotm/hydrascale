package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConsolePassword(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "console.password")

	if err := os.WriteFile(path, []byte("s3cret\nignored\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if got, err := LoadConsolePassword(path); err != nil || got != "s3cret" {
		t.Errorf("LoadConsolePassword = %q, %v; want s3cret, nil", got, err)
	}

	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadConsolePassword(path); err == nil {
		t.Error("LoadConsolePassword accepted a file with mode 0644")
	}

	if err := os.WriteFile(path, []byte("\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadConsolePassword(path); err == nil {
		t.Error("LoadConsolePassword accepted an empty password")
	}
}
