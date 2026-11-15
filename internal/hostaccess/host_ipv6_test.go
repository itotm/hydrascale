package hostaccess

import "testing"

func TestWithoutIPv6RemovesEveryIPv6Address(t *testing.T) {
	in := TailnetPeers{
		TailnetID: "home",
		Peers:     []Peer{{Hostname: "a", IPv4: "100.64.0.1", IPv6: "fd7a:115c:a1e0::1"}},
		Services:  []Service{{Name: "svc:web", IPv4: []string{"100.64.0.2"}, IPv6: []string{"fd7a:115c:a1e0::2"}}},
	}
	out := withoutIPv6(in)
	if out.Peers[0].IPv6 != "" || out.Peers[0].IPv4 != "100.64.0.1" {
		t.Errorf("peer = %+v, want the IPv4 address only", out.Peers[0])
	}
	if out.Services[0].IPv6 != nil || len(out.Services[0].IPv4) != 1 {
		t.Errorf("service = %+v, want the IPv4 address only", out.Services[0])
	}
	if in.Peers[0].IPv6 == "" {
		t.Error("withoutIPv6 changed its input")
	}
	v4, v6 := desiredPeerRoutes(out)
	if len(v4) != 1 || len(v6) != 0 {
		t.Errorf("desiredPeerRoutes = %v, %v; want one IPv4 route and no IPv6 route", v4, v6)
	}
}
