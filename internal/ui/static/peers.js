// The peers view: every peer of every tailnet, with every field that tailscaled reports,
// and one click to copy a name or an address.
//
// The model functions at the top need no document, so internal/ui/jstest/peers.test.mjs
// tests them under Node. The drawing below them needs a document.
//
// The view reads GET /api/tailnet/{id}/detail for each declared tailnet, at most once per
// DETAIL_TTL_MS, on the cadence of the poll layer. It starts no timer for the data.

import { registerView, requestJSON } from "./app.js";

/** The age at which the view asks the daemon for the detail of a tailnet again. */
export const DETAIL_TTL_MS = 10000;

/** The time that a copied value shows the word "copied". */
const COPIED_MS = 1500;

const ABSENT = "—";

// ---------------------------------------------------------------------------
// The model. Nothing here needs a document.
// ---------------------------------------------------------------------------

/** shortName returns the first label of a MagicDNS name, or the host name. */
export function shortName(peer) {
  const dns = (peer.dns_name || "").replace(/\.$/, "");
  if (dns) {
    return dns.split(".")[0];
  }
  return peer.host_name || ABSENT;
}

/** ipv4Of and ipv6Of return the first Tailscale address of each family. */
export function ipv4Of(peer) {
  return (peer.tailscale_ips || []).find((ip) => !ip.includes(":")) || "";
}
export function ipv6Of(peer) {
  return (peer.tailscale_ips || []).find((ip) => ip.includes(":")) || "";
}

/** offersExitNode reports whether a peer offers itself as exit node. */
export function offersExitNode(peer) {
  if (peer.exit_node_option) {
    return true;
  }
  return (peer.allowed_ips || []).includes("0.0.0.0/0");
}

/**
 * subnetsOf returns the subnet routes that a peer serves: primary_routes when the daemon
 * reports them, and otherwise allowed_ips without the addresses of the peer itself and
 * without the exit node routes.
 */
export function subnetsOf(peer) {
  const own = new Set(peer.tailscale_ips || []);
  const source = peer.primary_routes && peer.primary_routes.length > 0 ? peer.primary_routes : peer.allowed_ips || [];
  return source.filter((route) => {
    const address = route.split("/")[0];
    return !own.has(address) && route !== "0.0.0.0/0" && route !== "::/0";
  });
}

/** formatBytes states a byte count with a binary unit. */
export function formatBytes(bytes) {
  if (!bytes || bytes < 0) {
    return "0 B";
  }
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** relativeTime states the distance from now to an ISO time, such as "5 min ago". */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) {
    return "";
  }
  const at = Date.parse(iso);
  if (Number.isNaN(at)) {
    return "";
  }
  const seconds = Math.round((at - now) / 1000);
  const past = seconds <= 0;
  const abs = Math.abs(seconds);
  let text;
  if (abs < 60) {
    text = `${abs} s`;
  } else if (abs < 3600) {
    text = `${Math.round(abs / 60)} min`;
  } else if (abs < 86400) {
    text = `${Math.round(abs / 3600)} h`;
  } else {
    text = `${Math.round(abs / 86400)} d`;
  }
  return past ? `${text} ago` : `in ${text}`;
}

/** connectionOf states how this host reaches a peer. */
export function connectionOf(peer) {
  if (!peer.online) {
    return { kind: "offline", text: "offline" };
  }
  if (peer.cur_addr) {
    return { kind: "direct", text: `direct ${peer.cur_addr}` };
  }
  if (peer.peer_relay) {
    return { kind: "relay", text: `peer relay ${peer.peer_relay}` };
  }
  if (peer.relay) {
    return { kind: "relay", text: `relay ${peer.relay}` };
  }
  return { kind: "idle", text: "idle" };
}

/**
 * buildPeerRows returns one row per peer of every tailnet.
 *
 * status is the body of GET /api/status, whose field desired maps a tailnet ID to its
 * configuration (Alias among it). details maps a tailnet ID to the body of its detail
 * route. now is the current time in milliseconds.
 */
export function buildPeerRows(status, details, now = Date.now()) {
  const desired = (status && status.desired) || {};
  const rows = [];
  for (const id of Object.keys(desired).sort()) {
    const alias = (desired[id] && desired[id].Alias) || "";
    const detail = details[id];
    for (const peer of (detail && detail.peers) || []) {
      const name = shortName(peer);
      const fqdn = (peer.dns_name || "").replace(/\.$/, "");
      const lastSeen = peer.online ? "" : relativeTime(peer.last_seen, now);
      rows.push({
        key: `${id}/${fqdn || peer.host_name || name}`,
        tailnet: id,
        alias,
        name,
        hostName: peer.host_name || "",
        fqdn,
        aliasName: alias && name !== ABSENT ? `${name}.${alias}.ts.internal` : "",
        ipv4: ipv4Of(peer),
        ipv6: ipv6Of(peer),
        os: peer.os || "",
        user: peer.user || "",
        tags: peer.tags || [],
        online: peer.online === true,
        active: peer.active === true,
        connection: connectionOf(peer),
        exitNode: peer.exit_node ? "in use" : offersExitNode(peer) ? "offers" : "",
        subnets: subnetsOf(peer),
        allowedIPs: peer.allowed_ips || [],
        rx: peer.rx_bytes || 0,
        tx: peer.tx_bytes || 0,
        lastSeen,
        lastSeenAt: peer.last_seen || "",
        lastHandshake: peer.last_handshake || "",
        created: peer.created || "",
        keyExpiry: peer.key_expiry || "",
        expired: peer.expired === true,
      });
    }
  }
  return rows;
}

/** SORTS maps a column key to the value that the column sorts by. */
export const SORTS = {
  name: (row) => row.name.toLowerCase(),
  tailnet: (row) => row.tailnet,
  ipv4: (row) => row.ipv4.split(".").map((part) => part.padStart(3, "0")).join("."),
  os: (row) => row.os,
  user: (row) => row.user,
  connection: (row) => row.connection.text,
  seen: (row) => (row.online ? "9" : row.lastSeenAt || "0"),
  traffic: (row) => String(row.rx + row.tx).padStart(16, "0"),
};

/**
 * filterRows keeps the rows that match the filter: a tailnet ID ("" for every tailnet),
 * online only, and a text that any name, address, OS, owner, tag or subnet contains.
 * sortRows sorts them: online first, then by the chosen column.
 */
export function filterRows(rows, filter) {
  const text = (filter.text || "").trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.tailnet && row.tailnet !== filter.tailnet) {
      return false;
    }
    if (filter.online && !row.online) {
      return false;
    }
    if (!text) {
      return true;
    }
    const haystack = [
      row.name, row.hostName, row.fqdn, row.aliasName, row.ipv4, row.ipv6, row.os, row.user,
      row.tailnet, row.alias, ...row.tags, ...row.subnets,
    ].join(" ").toLowerCase();
    return text.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function sortRows(rows, sort) {
  const key = SORTS[sort.key] || SORTS.name;
  const dir = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort.key !== "seen" && a.online !== b.online) {
      return a.online ? -1 : 1;
    }
    const x = key(a);
    const y = key(b);
    if (x < y) return -dir;
    if (x > y) return dir;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// The drawing. Everything below this line needs a document.
// ---------------------------------------------------------------------------

const details = {};
const pending = new Set();
const expanded = new Set();
const filter = { text: "", tailnet: "", online: false };
const sort = { key: "name", desc: false };
let copied = { value: "", at: 0 };
let section = null;
let snapshot = null;
let body = null;
let tools = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/** copyText writes text to the clipboard, with a fallback for a browser without the API. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = el("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "peers-offscreen";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  copied = { value: text, at: Date.now() };
  renderBody();
  setTimeout(renderBody, COPIED_MS + 50);
}

/**
 * copyable draws a value as a button that copies it. The button shows the word "copied"
 * for a moment after a click.
 */
function copyable(value, className = "") {
  if (!value) {
    return el("span", "peers-absent", ABSENT);
  }
  const button = el("button", `copy mono ${className}`.trim());
  button.type = "button";
  button.title = `Copy ${value}`;
  button.append(el("span", "copy-value", value));
  if (copied.value === value && Date.now() - copied.at < COPIED_MS) {
    button.classList.add("copied");
    button.append(el("span", "copy-flag", "copied"));
  }
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    copyText(value);
  });
  return button;
}

/** refresh asks for the detail of each tailnet whose cached value expired. */
function refresh() {
  if (!snapshot || !snapshot.status || !snapshot.status.desired) {
    return;
  }
  const now = Date.now();
  for (const id of Object.keys(snapshot.status.desired)) {
    const entry = details[id];
    if ((entry && now - entry.at < DETAIL_TTL_MS) || pending.has(id)) {
      continue;
    }
    pending.add(id);
    requestJSON(`/api/tailnet/${encodeURIComponent(id)}/detail`)
      .then((value) => {
        details[id] = { at: Date.now(), value };
      })
      .catch(() => {})
      .finally(() => {
        pending.delete(id);
        renderBody();
      });
  }
}

function detailValues() {
  const out = {};
  for (const [id, entry] of Object.entries(details)) {
    out[id] = entry.value;
  }
  return out;
}

/** drawTools draws the filter bar once. The poll redraws the table only, so typing keeps the focus. */
function drawTools() {
  tools = el("div", "peers-tools");

  const search = el("input", "field peers-search");
  search.type = "search";
  search.placeholder = "Filter: name, address, OS, owner, tag, subnet";
  search.setAttribute("aria-label", "Filter the peers");
  search.value = filter.text;
  search.addEventListener("input", () => {
    filter.text = search.value;
    renderBody();
  });
  tools.append(search);

  const tailnets = el("div", "seg peers-tailnets");
  tailnets.setAttribute("role", "group");
  tailnets.setAttribute("aria-label", "Tailnet");
  tools.append(tailnets);

  const online = el("label", "peers-check");
  const box = el("input");
  box.type = "checkbox";
  box.checked = filter.online;
  box.addEventListener("change", () => {
    filter.online = box.checked;
    renderBody();
  });
  online.append(box, document.createTextNode(" online only"));
  tools.append(online);

  tools.append(el("span", "peers-hint", "Click a name or an address to copy it. Click a row for every field."));
  return tools;
}

/** drawTailnetChoices fills the tailnet segment, which changes when a tailnet comes or goes. */
function drawTailnetChoices(ids) {
  const group = tools.querySelector(".peers-tailnets");
  group.replaceChildren();
  for (const id of ["", ...ids]) {
    const button = el("button", undefined, id || "all");
    button.type = "button";
    button.setAttribute("aria-pressed", filter.tailnet === id ? "true" : "false");
    button.addEventListener("click", () => {
      filter.tailnet = id;
      renderBody();
    });
    group.append(button);
  }
}

/** drawSelf draws one card per tailnet: this node, its owner, its version and its warnings. */
function drawSelf(status, values) {
  const wrap = el("div", "peers-self");
  for (const id of Object.keys(status.desired || {}).sort()) {
    const detail = values[id];
    const alias = (status.desired[id] && status.desired[id].Alias) || "";
    const card = el("div", "peers-self-card");
    const head = el("div", "peers-self-head");
    head.append(el("span", "peers-self-id mono", id));
    if (alias) {
      head.append(el("span", "peers-self-alias", `alias ${alias}`));
    }
    if (detail) {
      head.append(el("span", "peers-self-count", `${detail.online_peers || 0} of ${detail.peer_count || 0} online`));
    }
    card.append(head);
    if (!detail) {
      card.append(el("p", "note", "No detail yet."));
      wrap.append(card);
      continue;
    }
    const grid = el("dl", "peers-kv");
    const add = (label, node) => {
      grid.append(el("dt", undefined, label));
      const dd = el("dd");
      dd.append(node);
      grid.append(dd);
    };
    if (detail.backend_state && detail.backend_state !== "Running") {
      const state = el("span", "peers-state-warn mono", detail.backend_state);
      add("state", state);
      if (detail.login_url) {
        const link = el("a", "peers-login", "log in");
        link.href = detail.login_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        state.after(link);
      }
    }
    add("tailnet", el("span", "mono", detail.tailnet_name || detail.magic_dns_suffix || ABSENT));
    add("this node", copyable((detail.magic_dns_name || "").replace(/\.$/, "")));
    add("address", copyable((detail.tailscale_ips || []).find((ip) => !ip.includes(":")) || ""));
    add("user", el("span", "mono", detail.self_user || ABSENT));
    add("tailscale", el("span", "mono", detail.version ? detail.version.split("-")[0] : ABSENT));
    card.append(grid);
    for (const warning of detail.health || []) {
      card.append(el("p", "peers-warn", warning));
    }
    if (detail.error) {
      card.append(el("p", "peers-warn", detail.error));
    }
    wrap.append(card);
  }
  return wrap;
}

const COLUMNS = [
  { key: "name", label: "Peer" },
  { key: "tailnet", label: "Tailnet" },
  { key: "ipv4", label: "IPv4" },
  { key: "os", label: "OS" },
  { key: "user", label: "Owner" },
  { key: "connection", label: "Connection" },
  { key: null, label: "Exit node · subnets" },
  { key: "seen", label: "Seen" },
];

function drawHead() {
  const thead = el("thead");
  const tr = el("tr");
  for (const column of COLUMNS) {
    const th = el("th");
    th.scope = "col";
    if (!column.key) {
      th.textContent = column.label;
    } else {
      const button = el("button", "peers-sort", column.label);
      button.type = "button";
      if (sort.key === column.key) {
        button.classList.add("on");
        button.append(el("span", "peers-arrow", sort.desc ? " ↓" : " ↑"));
        th.setAttribute("aria-sort", sort.desc ? "descending" : "ascending");
      }
      button.addEventListener("click", () => {
        sort.desc = sort.key === column.key ? !sort.desc : false;
        sort.key = column.key;
        renderBody();
      });
      th.append(button);
    }
    tr.append(th);
  }
  thead.append(tr);
  return thead;
}

function drawRow(row, tbody) {
  const tr = el("tr", row.online ? "peer" : "peer off");
  tr.tabIndex = 0;
  tr.setAttribute("aria-expanded", expanded.has(row.key) ? "true" : "false");

  const name = el("th", "peers-name");
  name.scope = "row";
  const line = el("div", "peers-name-line");
  line.append(el("span", row.online ? (row.active ? "dot ok" : "dot ok dim") : "dot"));
  line.append(copyable(row.name, "peers-strong"));
  if (row.expired) {
    line.append(el("span", "peers-badge crit", "key expired"));
  }
  name.append(line);
  if (row.aliasName) {
    const sub = el("div", "peers-sub");
    sub.append(copyable(row.aliasName));
    name.append(sub);
  }
  tr.append(name);

  tr.append(el("td", "mono", row.tailnet));
  const ip = el("td");
  ip.append(copyable(row.ipv4));
  tr.append(ip);
  tr.append(el("td", "mono", row.os || ABSENT));
  const owner = el("td", "peers-owner", row.user || ABSENT);
  if (row.tags.length) {
    owner.title = row.tags.join(", ");
  }
  tr.append(owner);
  tr.append(el("td", `mono peers-conn ${row.connection.kind}`, row.connection.text));

  const routes = el("td", "peers-routes");
  if (row.exitNode) {
    routes.append(el("span", row.exitNode === "in use" ? "peers-badge accent" : "peers-badge", `exit node ${row.exitNode === "in use" ? "in use" : ""}`.trim()));
  }
  for (const subnet of row.subnets) {
    routes.append(copyable(subnet, "peers-subnet"));
  }
  if (!row.exitNode && row.subnets.length === 0) {
    routes.append(el("span", "peers-absent", ABSENT));
  }
  tr.append(routes);

  tr.append(el("td", "mono peers-seen", row.online ? (row.active ? "active" : "online") : row.lastSeen || ABSENT));

  const toggle = () => {
    if (expanded.has(row.key)) {
      expanded.delete(row.key);
    } else {
      expanded.add(row.key);
    }
    renderBody();
  };
  tr.addEventListener("click", toggle);
  tr.addEventListener("keydown", (event) => {
    if (event.target === tr && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggle();
    }
  });
  tbody.append(tr);

  if (expanded.has(row.key)) {
    tbody.append(drawDetail(row));
  }
}

function drawDetail(row) {
  const tr = el("tr", "peer-detail");
  const td = el("td");
  td.colSpan = COLUMNS.length;
  const grid = el("dl", "peers-kv wide");
  const add = (label, node) => {
    grid.append(el("dt", undefined, label));
    const dd = el("dd");
    if (Array.isArray(node)) {
      node.forEach((n) => dd.append(n));
    } else {
      dd.append(node);
    }
    grid.append(dd);
  };
  const text = (value) => el("span", "mono", value || ABSENT);
  const when = (iso) => {
    if (!iso) {
      return text("");
    }
    const span = el("span", "mono", `${new Date(iso).toLocaleString()} (${relativeTime(iso)})`);
    return span;
  };
  add("MagicDNS name", copyable(row.fqdn));
  add("short name", copyable(row.aliasName));
  add("host name", copyable(row.hostName));
  add("IPv4", copyable(row.ipv4));
  add("IPv6", copyable(row.ipv6));
  add("allowed IPs", row.allowedIPs.length ? row.allowedIPs.map((ip) => copyable(ip)) : text(""));
  add("subnet routes", row.subnets.length ? row.subnets.map((ip) => copyable(ip)) : text(""));
  add("exit node", text(row.exitNode || "no"));
  add("owner", text(row.user));
  add("tags", text(row.tags.join(", ")));
  add("OS", text(row.os));
  add("connection", text(row.connection.text));
  add("traffic", text(`↓ ${formatBytes(row.rx)}  ↑ ${formatBytes(row.tx)}`));
  add("received", text(`${formatBytes(row.rx)} (${row.rx} B)`));
  add("sent", text(`${formatBytes(row.tx)} (${row.tx} B)`));
  add("last handshake", when(row.lastHandshake));
  add("last seen", row.online ? text("online now") : when(row.lastSeenAt));
  add("created", when(row.created));
  add("key expiry", row.keyExpiry ? when(row.keyExpiry) : text("never"));
  td.append(grid);
  tr.append(td);
  return tr;
}

/** renderBody draws everything below the filter bar. */
function renderBody() {
  if (!section || !snapshot || !body) {
    return;
  }
  body.replaceChildren();
  if (snapshot.loading || !snapshot.status) {
    body.append(el("p", "note", "The first poll has not returned."));
    return;
  }
  const status = snapshot.status;
  const ids = Object.keys(status.desired || {}).sort();
  drawTailnetChoices(ids);
  if (ids.length === 0) {
    body.append(el("p", "note", "No tailnet is configured."));
    return;
  }
  const values = detailValues();
  body.append(drawSelf(status, values));

  const all = buildPeerRows(status, values);
  const rows = sortRows(filterRows(all, filter), sort);
  const online = all.filter((row) => row.online).length;
  body.append(el("p", "peers-count", `${rows.length} shown · ${all.length} peers · ${online} online`));

  const frame = el("div", "peers-frame");
  const table = el("table", "peers-table");
  table.append(drawHead());
  const tbody = el("tbody");
  for (const row of rows) {
    drawRow(row, tbody);
  }
  table.append(tbody);
  frame.append(table);
  body.append(frame);
  if (rows.length === 0) {
    body.append(el("p", "note", all.length ? "No peer matches the filter." : "No peer yet: the detail of each tailnet arrives within a few seconds."));
  }
}

function draw(target, next) {
  snapshot = next;
  if (section !== target || !target.querySelector(".peers-tools")) {
    section = target;
    section.replaceChildren();
    section.append(drawTools());
    body = el("div", "peers-body");
    section.append(body);
  }
  refresh();
  renderBody();
}

if (typeof document !== "undefined") {
  registerView("peers", draw);
}
