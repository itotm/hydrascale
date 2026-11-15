package dns

import "testing"

func TestRouteForMatchesOnALabelBoundaryAndTakesTheLongestSuffix(t *testing.T) {
	routes := map[string]string{
		"example.com":      "10.200.0.1",
		"corp.example.com": "10.200.0.5",
		"tail1234.ts.net":  "10.200.0.9",
	}
	for name, want := range map[string]string{
		"host.corp.example.com.": "10.200.0.5",
		"corp.example.com.":      "10.200.0.5",
		"notcorp.example.com.":   "10.200.0.1",
		"www.example.com.":       "10.200.0.1",
		"nas.TAIL1234.ts.net.":   "10.200.0.9",
		"badtail1234.ts.net.":    "",
		"github.com.":            "",
		"example.com.evil.org.":  "",
	} {
		if got := routeFor(routes, name); got != want {
			t.Errorf("routeFor(%q) = %q, want %q", name, got, want)
		}
	}
}
