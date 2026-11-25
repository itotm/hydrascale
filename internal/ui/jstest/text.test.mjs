// The text helper of the views, and the rule that the console cuts no text.
//
// The Go test TestTheConsoleJavaScriptTestsPass starts this file.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { breakPoints } from "../static/text.js";
import { NODE_W, WIDTH, buildTopology } from "../static/topology.js";

test("a long value breaks after a separator and the parts hold the whole value", () => {
  assert.deepEqual(breakPoints("some.user@example.com"), ["some.", "user@", "example.", "com"]);
  assert.deepEqual(breakPoints("ts-r6400.casa.ts.internal"), ["ts-", "r6400.", "casa.", "ts.", "internal"]);
  for (const value of ["--state=/var/lib/x.state", "fd7a:115c:a1e0::1", "HYDRASCALE_TS_SECRET", ""]) {
    assert.equal(breakPoints(value).join(""), value);
  }
});

test("an IPv4 address and a CIDR block hold no break", () => {
  assert.deepEqual(breakPoints("100.67.240.20"), ["100.67.240.20"]);
  assert.deepEqual(breakPoints("192.168.178.0/24"), ["192.168.178.0/24"]);
});

test("app.css ends no text in an ellipsis", async () => {
  const style = await readFile(new URL("../static/app.css", import.meta.url), "utf8");
  assert.doesNotMatch(style, /text-overflow/);
});

test("a long tailnet identifier makes its column of the topology wider", () => {
  const access = (id) => ({ nodes: [{ id, kind: "tailnet", peers: 4 }, { id: "host", kind: "host" }], rules: [] });
  const short = buildTopology({}, access("home"));
  assert.equal(short.nodes[0].w, NODE_W);
  assert.equal(short.width, WIDTH);

  const id = "a".repeat(63);
  const long = buildTopology({}, access(id));
  assert.ok(long.nodes[0].w > id.length * 7.8);
  assert.equal(long.width - WIDTH, long.nodes[0].w - NODE_W);
  for (const node of long.nodes) {
    assert.ok(node.x + node.w <= long.width);
  }
});
