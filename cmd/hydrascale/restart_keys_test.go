package main

import (
	"bytes"
	"log"
	"os"
	"strings"
	"testing"

	"hydrascale/internal/config"
)

func TestWarnRestartKeysNamesEachStartOnlyKeyThatChanged(t *testing.T) {
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })

	off := false
	started := &config.Config{RouteTable: 53, InfraSubnet: "10.200.0.0/16"}
	next := &config.Config{RouteTable: 54, InfraSubnet: "10.200.0.0/16", HostIPv6: &off}
	warnRestartKeys(started, next)

	out := buf.String()
	for _, key := range []string{"route_table", "host_ipv6"} {
		if !strings.Contains(out, key) {
			t.Errorf("the log names no %s:\n%s", key, out)
		}
	}
	if strings.Contains(out, "infra_subnet") || strings.Contains(out, "host_dns.mode") {
		t.Errorf("the log names a key that did not change:\n%s", out)
	}
}
