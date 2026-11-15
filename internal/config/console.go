package config

import (
	"fmt"
	"net"
	"os"
	"strings"
)

// DefaultConsoleBindAddress is the address that the console serves when the
// configuration file holds no console.bind_address key.
const DefaultConsoleBindAddress = "127.0.0.1:9443"

// ConsoleConfig holds the console listener settings.
// Enabled is a pointer, because a version 0.9 file holds no console key and an absent key
// means true. A false value disables the listener.
type ConsoleConfig struct {
	Enabled     *bool  `yaml:"enabled,omitempty"`
	BindAddress string `yaml:"bind_address,omitempty"`
	// PasswordFile names a root-only file (mode 0600) that holds the console password on
	// its first line. When it is set, every console request needs HTTP basic
	// authentication with that password; the user name is free. Empty keeps the console
	// open to every local account, as upstream does.
	PasswordFile string `yaml:"password_file,omitempty"`
}

// ConsoleEnabled reports whether the daemon opens the console listener.
// ConsoleEnabled returns true when the file holds no console.enabled key.
func (c *Config) ConsoleEnabled() bool {
	if c.Console.Enabled == nil {
		return true
	}
	return *c.Console.Enabled
}

// ConsoleBindAddress returns the address that the console listener binds.
// ConsoleBindAddress returns DefaultConsoleBindAddress when the file holds no
// console.bind_address key.
func (c *Config) ConsoleBindAddress() string {
	if c.Console.BindAddress == "" {
		return DefaultConsoleBindAddress
	}
	return c.Console.BindAddress
}

// ValidateConsoleBindAddress checks that addr is a loopback host and a port.
// The console has no authentication, so a listener on a non-loopback address gives every
// host on the network control of a root daemon. See the section "The console has no
// authentication" of docs/specs/spec.md.
//
// ValidateConsoleBindAddress refuses a name such as localhost, because a name resolves to
// an address that the operator can change.
func ValidateConsoleBindAddress(addr string) error {
	if addr == "" {
		return fmt.Errorf("console.bind_address is required")
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("invalid console.bind_address %q: %w", addr, err)
	}
	if port == "" {
		return fmt.Errorf("invalid console.bind_address %q: the address holds no port", addr)
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return fmt.Errorf("invalid console.bind_address %q: the console must bind a loopback address, such as %s", addr, DefaultConsoleBindAddress)
	}
	return nil
}

// LoadConsolePassword reads the console password from path. It refuses a file that is not
// a regular file, a file that grants access to a group or to other accounts, and a file
// whose first line is empty.
func LoadConsolePassword(path string) (string, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "", fmt.Errorf("console.password_file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("console.password_file %s is not a regular file", path)
	}
	if perm := info.Mode().Perm(); perm&0077 != 0 {
		return "", fmt.Errorf("console.password_file %s has mode %04o, and the daemon reads mode 0600 only", path, perm)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("console.password_file: %w", err)
	}
	password, _, _ := strings.Cut(string(data), "\n")
	password = strings.TrimRight(password, "\r")
	if password == "" {
		return "", fmt.Errorf("console.password_file %s holds no password on its first line", path)
	}
	return password, nil
}
