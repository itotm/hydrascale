package main

import (
	"os"
	"path/filepath"
	"testing"
)

// On Fedora Atomic /usr/local is a symlink to /var/usrlocal. installBinary must see that
// the running binary is already the target and copy nothing.
func TestInstallBinarySkipsTheSameFileBehindASymlink(t *testing.T) {
	dir := t.TempDir()
	real := filepath.Join(dir, "var", "usrlocal", "bin")
	if err := os.MkdirAll(real, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(dir, "var", "usrlocal"), filepath.Join(dir, "usrlocal")); err != nil {
		t.Fatal(err)
	}
	self := filepath.Join(real, "hydrascale")
	if err := os.WriteFile(self, []byte("binary"), 0755); err != nil {
		t.Fatal(err)
	}

	copied, err := installBinary(self, filepath.Join(dir, "usrlocal", "bin", "hydrascale"))
	if err != nil {
		t.Fatalf("installBinary returned %v", err)
	}
	if copied {
		t.Fatal("installBinary copied the binary onto itself")
	}
}

func TestInstallBinaryCopiesToANewTarget(t *testing.T) {
	dir := t.TempDir()
	self := filepath.Join(dir, "hydrascale")
	if err := os.WriteFile(self, []byte("new"), 0755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(dir, "bin-hydrascale")
	if err := os.WriteFile(target, []byte("old"), 0755); err != nil {
		t.Fatal(err)
	}

	copied, err := installBinary(self, target)
	if err != nil || !copied {
		t.Fatalf("installBinary = %v, %v; want true, nil", copied, err)
	}
	data, _ := os.ReadFile(target)
	if string(data) != "new" {
		t.Fatalf("target holds %q, want %q", data, "new")
	}
	info, _ := os.Stat(target)
	if info.Mode().Perm() != 0755 {
		t.Fatalf("target mode %v, want 0755", info.Mode().Perm())
	}
}
