package namespaces

import (
	"testing"

	"hydrascale/internal/config"
)

func TestConfigVethIndexForEqualsVethIndex(t *testing.T) {
	for _, id := range []string{"home", "work", "biblio", "corp-prod", "a", "x.y_z"} {
		if got, want := config.VethIndexFor(id), VethIndex(GetNamespaceName(id)); got != want {
			t.Errorf("config.VethIndexFor(%q) = %d, VethIndex = %d", id, got, want)
		}
	}
}
