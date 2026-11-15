<h1 align="center">hydrascale</h1>

<p align="center">A fork of <a href="https://github.com/Crank-Git/Hydrascale">Hydrascale</a>, which runs multiple Tailscale tailnets simultaneously on a single Linux machine.</p>

> **This is a fork.** It is a quick experiment that adapts Hydrascale to the needs of one
> setup (a Fedora Atomic desktop with several tailnets and no IPv6). It is not a maintained
> distribution: use the upstream project unless you need exactly these changes.
> The changes were developed with the help of an LLM.

What Hydrascale does, its requirements, the install, the configuration and the rest of the
documentation are in the upstream repository,
[Crank-Git/Hydrascale](https://github.com/Crank-Git/Hydrascale), and on its
[documentation site](https://crank-git.github.io/Hydrascale/). They apply to this fork as
well, together with the changes below.

## Changes in the fork

- **Peers view** in the console: every peer of every tailnet with every field that
  `tailscale status` reports (owner, tags, connection direct or relay, exit node, subnet
  routes, traffic, handshake, key expiry); click a name or an address to copy it.
- **Light theme** that follows the system, a theme switch, larger type and a wider mono.
- **`console.password_file`**: optional HTTP basic authentication for the console.
- **`host_ipv6: false`**: no IPv6 routes, rule or AAAA records on a host without IPv6.
- **Fixes**: `GET /api/access` failed with HTTP 500 on a host without IPv6 when a
  dual-stack service had an IPv4 client (`::ffff:` addresses); the DNS forwarder matched
  split domains without a label boundary and forwarded TCP queries over UDP;
  systemd-resolved links stayed registered after their tailnet left; a removed and
  re-added tailnet kept its error state; `hydrascale install` failed with "text file
  busy" when `/usr/local` is a symlink; two tailnets could share the same veth addresses;
  an unknown `host_dns.mode` loaded silently; the journal got 13 identical lines every
  10 seconds and the routine ticks pushed the real events out of the event list;
  `exit_node` is now reported as not applied instead of being silently ignored; the
  overview showed a tailnet waiting for a login as healthy, and its auth key was never
  retried; host access added by a reload did nothing until a restart; a removed tailnet
  could keep its host names; a subnet route that two tailnets accept flapped between them;
  a route table that did not exist yet for IPv6 stopped the IPv4 route sync.
- The fork publishes no documentation site. Its two new keys are described in
  [docs/site/reference/configuration.md](docs/site/reference/configuration.md) and
  [docs/site/security/console.md](docs/site/security/console.md).

## Releases

The [releases of the fork](https://github.com/itotm/hydrascale/releases) carry versions
such as `v1.8.0-fork.1` (upstream version, then the fork build). Their archives hold the
same files as the upstream archives.

## License

MIT License. See [LICENSE](LICENSE) for details.
