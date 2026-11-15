package hostaccess

import (
	"testing"

	"hydrascale/internal/execx"
)

// A device that leaves the link set gets reverted, so it stops sending the domain of its
// tailnet to a resolver that no longer answers. The test uses lo, the one device that
// every host holds.
func TestRegisterDomainsRevertsADeviceThatLeavesTheSet(t *testing.T) {
	rec := execx.NewRecorder(t)
	rec.Script(execx.Result{}, "systemctl", "is-active", "--quiet", "systemd-resolved")
	rec.Script(execx.Result{}, "resolvectl", "dns", "lo", "10.200.1.46")
	rec.Script(execx.Result{}, "resolvectl", "domain", "lo", "~corp.ts.net")
	rec.Script(execx.Result{}, "resolvectl", "revert", "lo")

	rm := NewResolvedManager()
	rm.Runner = rec
	if err := rm.RegisterDomains([]Link{{Device: "lo", Address: "10.200.1.46", Domains: []string{"corp.ts.net"}}}); err != nil {
		t.Fatalf("RegisterDomains: %v", err)
	}
	if err := rm.RegisterDomains(nil); err != nil {
		t.Fatalf("RegisterDomains(nil): %v", err)
	}

	calls := rec.Calls()
	last := calls[len(calls)-1]
	if last.String() != (execx.Call{Name: "resolvectl", Args: []string{"revert", "lo"}}).String() {
		t.Fatalf("the last command is %q, want resolvectl revert lo:\n%s", last.String(), callList(calls))
	}
	if len(rm.registered) != 0 {
		t.Errorf("registered = %v after the revert, want none", rm.registered)
	}
}
