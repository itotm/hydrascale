package api

import (
	"context"
	"encoding/base64"
	"net/http"
	"testing"
	"time"
)

func startPasswordConsole(t *testing.T, password string) string {
	t.Helper()
	srv := NewServer(tempSocketPath(t, "console-pw.sock"), newTestReconciler(writeTestConfig(t, "alpha")))
	srv.SetConsolePassword(password)
	if err := srv.StartConsole(true, "127.0.0.1:0"); err != nil {
		t.Fatalf("StartConsole: %v", err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	})
	return "http://" + srv.ConsoleAddress()
}

func basic(user, password string) map[string]string {
	return map[string]string{"Authorization": "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+password))}
}

func TestAConsoleWithAPasswordRefusesARequestWithoutIt(t *testing.T) {
	origin := startPasswordConsole(t, "s3cret")
	for _, path := range []string{"/", "/api/status"} {
		resp := consoleCall(t, http.MethodGet, origin+path, "", nil)
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("GET %s with no password returns %d, want 401", path, resp.StatusCode)
		}
		if resp.Header.Get("WWW-Authenticate") == "" {
			t.Errorf("GET %s: the 401 carries no WWW-Authenticate header, so the browser asks for nothing", path)
		}
	}
	if resp := consoleCall(t, http.MethodGet, origin+"/api/status", "", basic("x", "wrong")); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("a wrong password returns %d, want 401", resp.StatusCode)
	}
}

func TestAConsoleWithAPasswordAcceptsItWithAnyUserName(t *testing.T) {
	origin := startPasswordConsole(t, "s3cret")
	for _, user := range []string{"admin", "", "operator"} {
		if resp := consoleCall(t, http.MethodGet, origin+"/api/status", "", basic(user, "s3cret")); resp.StatusCode != http.StatusOK {
			t.Errorf("user %q with the password returns %d, want 200", user, resp.StatusCode)
		}
	}
}

func TestAConsoleWithoutAPasswordStaysOpen(t *testing.T) {
	origin := startPasswordConsole(t, "")
	if resp := consoleCall(t, http.MethodGet, origin+"/api/status", "", nil); resp.StatusCode != http.StatusOK {
		t.Errorf("GET /api/status returns %d, want 200", resp.StatusCode)
	}
}
