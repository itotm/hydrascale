import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPeerRows,
  connectionOf,
  filterRows,
  formatBytes,
  relativeTime,
  sortRows,
  subnetsOf,
} from "../static/peers.js";

const status = {
  desired: {
    home: { ID: "home", Alias: "casa" },
    work: { ID: "work", Alias: "" },
  },
};

const details = {
  home: {
    peers: [
      {
        host_name: "R6400", dns_name: "ts-r6400.tail1.ts.net", os: "linux",
        tailscale_ips: ["100.67.240.20", "fd7a:115c:a1e0::1"],
        allowed_ips: ["100.67.240.20/32", "fd7a:115c:a1e0::1/128", "10.0.1.0/24", "0.0.0.0/0", "::/0"],
        primary_routes: ["10.0.1.0/24"], exit_node_option: true, online: true, active: true,
        relay: "fra", rx_bytes: 2048, tx_bytes: 10, user: "tagged-devices", tags: ["tag:router"],
      },
      {
        host_name: "r7000", dns_name: "ts-r7000.tail1.ts.net.", os: "linux",
        tailscale_ips: ["100.91.229.60"], allowed_ips: ["100.91.229.60/32"],
        online: false, last_seen: "2026-11-15T08:05:26Z",
      },
    ],
  },
  work: {
    peers: [
      {
        host_name: "rb02", dns_name: "ts-rb02.tail2.ts.net", os: "linux",
        tailscale_ips: ["100.75.105.89"], allowed_ips: ["100.75.105.89/32", "10.0.5.0/24"],
        online: true, cur_addr: "203.0.113.4:41641",
      },
    ],
  },
};

test("buildPeerRows names each peer by its MagicDNS label and builds the alias name", () => {
  const rows = buildPeerRows(status, details, Date.parse("2026-11-15T09:05:26Z"));
  assert.equal(rows.length, 3);
  const r6400 = rows.find((row) => row.name === "ts-r6400");
  assert.equal(r6400.aliasName, "ts-r6400.casa.ts.internal");
  assert.equal(r6400.ipv4, "100.67.240.20");
  assert.equal(r6400.ipv6, "fd7a:115c:a1e0::1");
  assert.deepEqual(r6400.subnets, ["10.0.1.0/24"]);
  assert.equal(r6400.exitNode, "offers");
  assert.equal(r6400.connection.text, "relay fra");
  const r7000 = rows.find((row) => row.name === "ts-r7000");
  assert.equal(r7000.fqdn, "ts-r7000.tail1.ts.net");
  assert.equal(r7000.lastSeen, "1 h ago");
  const rb02 = rows.find((row) => row.name === "ts-rb02");
  assert.equal(rb02.aliasName, "", "a tailnet with no alias has no short name");
  assert.deepEqual(rb02.subnets, ["10.0.5.0/24"], "allowed_ips stands in for primary_routes");
  assert.equal(rb02.connection.kind, "direct");
});

test("filterRows matches every word against names, addresses, tags and subnets", () => {
  const rows = buildPeerRows(status, details);
  assert.deepEqual(filterRows(rows, { text: "10.0.5" }).map((r) => r.name), ["ts-rb02"]);
  assert.deepEqual(filterRows(rows, { text: "tag:router" }).map((r) => r.name), ["ts-r6400"]);
  assert.deepEqual(filterRows(rows, { text: "casa r6400" }).map((r) => r.name), ["ts-r6400"]);
  assert.equal(filterRows(rows, { online: true }).length, 2);
  assert.equal(filterRows(rows, { tailnet: "work" }).length, 1);
});

test("sortRows puts the online peers first and sorts by the column", () => {
  const rows = buildPeerRows(status, details);
  assert.deepEqual(sortRows(rows, { key: "name" }).map((r) => r.name), ["ts-r6400", "ts-rb02", "ts-r7000"]);
  assert.deepEqual(sortRows(rows, { key: "name", desc: true }).map((r) => r.name), ["ts-rb02", "ts-r6400", "ts-r7000"]);
});

test("the formatters state bytes, times, connections and subnets", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KiB");
  assert.equal(formatBytes(5 * 1024 * 1024 * 1024), "5.0 GiB");
  const now = Date.parse("2026-11-15T12:00:00Z");
  assert.equal(relativeTime("2026-11-15T11:59:30Z", now), "30 s ago");
  assert.equal(relativeTime("2027-01-14T12:00:00Z", now), "in 60 d");
  assert.equal(relativeTime("", now), "");
  assert.equal(connectionOf({ online: false }).kind, "offline");
  assert.equal(connectionOf({ online: true }).kind, "idle");
  assert.deepEqual(subnetsOf({ tailscale_ips: ["100.1.1.1"], allowed_ips: ["100.1.1.1/32", "0.0.0.0/0", "::/0"] }), []);
});
