package scripts

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// readmeSections are the "## " headings of the README of the fork, in order. The fork
// links to the upstream repository for everything else, so the README holds only these.
var readmeSections = []string{
	"Changes in the fork",
	"Releases",
	"License",
}

func readReadme(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "README.md"))
	if err != nil {
		t.Fatalf("read README.md: %v", err)
	}
	return string(data)
}

func TestTheReadmeIsShort(t *testing.T) {
	lines := strings.Count(readReadme(t), "\n")
	if lines > 220 {
		t.Errorf("README.md holds %d lines; FR-readme-1 allows 220 or fewer", lines)
	}
}

func TestTheReadmeSectionsAreInOrder(t *testing.T) {
	var got []string
	inFence := false
	for _, line := range strings.Split(readReadme(t), "\n") {
		if strings.HasPrefix(line, "```") {
			inFence = !inFence
		}
		if !inFence && strings.HasPrefix(line, "## ") {
			got = append(got, strings.TrimPrefix(line, "## "))
		}
	}
	if !slices.Equal(got, readmeSections) {
		t.Errorf("the README sections are %q; the fork requires %q", got, readmeSections)
	}
}

var (
	repoMarkdownLink = regexp.MustCompile(`\]\(([^)\s]+)\)`)
	repoAttrLink     = regexp.MustCompile(`(?:href|src)="([^"]+)"`)
)

func TestEachRepositoryLinkOfTheReadmeExists(t *testing.T) {
	readme := readReadme(t)
	var targets []string
	for _, m := range repoMarkdownLink.FindAllStringSubmatch(readme, -1) {
		targets = append(targets, m[1])
	}
	for _, m := range repoAttrLink.FindAllStringSubmatch(readme, -1) {
		targets = append(targets, m[1])
	}
	for _, target := range targets {
		if strings.Contains(target, "://") || strings.HasPrefix(target, "#") ||
			strings.HasPrefix(target, "mailto:") {
			continue
		}
		file, _, _ := strings.Cut(target, "#")
		if _, err := os.Stat(filepath.Join("..", file)); err != nil {
			t.Errorf("the README links to %s, which does not exist (FR-readme-9)", target)
		}
		if strings.HasSuffix(file, ".png") && !strings.HasPrefix(file, "docs/site/images/") {
			t.Errorf("the screenshot %s is not under docs/site/images/ (FR-readme-11)", target)
		}
	}
}

// The mode observe writes its lines through the iptables LOG target. The kernel writes
// them, so journald stores no systemd unit with them, and "journalctl -u hydrascale"
// shows none of them.
func TestNoDocumentReadsTheObserveLogByUnit(t *testing.T) {
	files := []string{filepath.Join("..", "README.md")}
	err := filepath.WalkDir(filepath.Join("..", "docs", "site"), func(path string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() && strings.HasSuffix(path, ".md") {
			files = append(files, path)
		}
		return err
	})
	if err != nil {
		t.Fatalf("walk docs/site: %v", err)
	}
	wrong := regexp.MustCompile(`journalctl -u hydrascale \| grep hydrascale-would-deny`)
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if wrong.Match(data) {
			t.Errorf("%s reads the observe log with journalctl -u; use journalctl -k", file)
		}
	}
}
