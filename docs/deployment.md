# Deployment

## Running deployment

GameVault uses a dedicated Cloudflare Tunnel and nginx container. The tunnel terminates public TLS and forwards to nginx on loopback port 18080. nginx forwards to the pinned GameVault 17.0.1 backend on loopback port 8080. The download site uses GitHub Pages with a DNS-only CNAME, giving the nested hostname its own certificate.

On this host, the Compose project is under `/opt/gamevault`. Its override retains the PostgreSQL, media and game mounts and persists config, save files, plugins, logs and DB state under `joiner-edge/backend-state`. The backend runs as UID/GID 1000, matching the prior application user and avoiding a recursive ownership change at startup. The credential files stay on the host with restricted permissions.

The pre-cutover directory is `/root/gamevault-precutover.Fojwwx`. It contains the original Compose file, a PostgreSQL archive that passed an isolated restore, copied application state, and a rollback override referring to the local container snapshot. Keep the archive and rollback image private.

## Pre-cutover inspection

The running backend reports **17.0.1** from its package and local health API. The installed code recognizes both registration flags and assigns ordinary signups the User role, with admin exceptions for initial setup and the configured recovery username. Registration is enabled and the activation override is unset. Before cutover Docker published port 8080 on all IPv4 and IPv6 interfaces. No service is listening locally on 80 or 443. Both names returned NXDOMAIN before the cutover. External reachability of port 8080 is unverified.

## Proposed settings and proxy

The [current GameVault configuration reference](https://gamevau.lt/docs/server/configuration/) documents both registration flags. Verify that the exact running backend version supports them before approval. Check the deployed release tag and image digest, the version in the Admin page, and runtime configuration precedence, including any mounted configuration or secret overrides. Verify GameVault’s demo mode is off and login attempt limiting is still effective at the proxy boundary. The first account on an empty installation gets administrator access automatically. Confirm a legitimate administrator already exists before allowing public registration. Activate new accounts with the default **User** role. Guest, inactive and anonymous users must be denied game downloads. See [upstream user management](https://gamevau.lt/docs/server/user-management/).

The prepared Compose override is for a host-local proxy and replaces the port mapping with loopback-only access. If the existing proxy is on another host, agree on a private-only bind and ACL for the proxy before applying a change. Do not replace the entire Compose file or move data. Keep PostgreSQL private. Use the exact production image digest during a settings-only recreate to avoid an accidental upgrade from the floating `latest` tag.

The example nginx virtual hosts preserve HTTPS and pass web/API traffic and WebSocket upgrades, with streaming responses. The GameVault example includes a rate limit on the installed backend’s basic login route because an application-level limiter was not identified in 17.0.1. Keep any existing stricter controls. The example assumes nginx is the first trusted hop. Behind a CDN or tunnel, configure the trusted client IP source and verify that unauthenticated traffic cannot choose its own rate-limit key. Avoid exposing operational dashboards, health details, debug middleware, or Swagger endpoints beyond administrative need. Preserve intentional administration access.

## Approval, backup and rollback

1. Capture the running image digests, resolved volume mappings, existing public proxy configuration and certificate references. Store resolved configuration in a restricted backup location because it can contain credentials.
2. Make a PostgreSQL logical backup with the matching major version’s `pg_dump -Fc`. Back up the Compose and secret references, game files, media and any additional writable GameVault mounts or container state. Test restore to an isolated database and verify record counts and representative data.
3. Review the proposed configuration difference, planned downtime, loopback or private routing, and exact rollback commands. Obtain explicit approval before any live change, DNS update, firewall edit or service exposure.
4. Validate the merged Compose configuration with `docker compose ... config --quiet` and the integrated proxy with `nginx -t`. Recreate only the GameVault service if needed with the existing image. Test the reverse-proxy path before switching traffic.
5. Check public HTTPS and certificate validation. Test Web UI and API login, WebSocket traffic where used, streaming and range requests, pending activation, disabled-account access, login rate limiting, and approved User downloads with designated test accounts. Verify the bare backend port is unreachable from outside the trusted network. Check expected health and latency from monitoring without logging passwords, tokens, or download URLs.
6. On regression, restore the prior Compose and proxy files, validate them, then recreate the affected service with its prior pinned image and reload the previous proxy configuration. Restore database or persistent files only if they were actually affected, using the tested backup procedure.

## Website

The Pages workflow builds `website/dist` and deploys static assets. The repository Pages custom domain is `join.gamevault.pcenthusiast.blog`, with a DNS-only CNAME pointing to `doopydoop364.github.io`. GitHub Pages now has an approved certificate and HTTPS enforcement. On 22 November 2026, a certificate mismatch was repaired by removing and re-adding the Pages custom domain; DNS and the GameVault server were unchanged. Verify the certificate across GitHub's published IPv4 and IPv6 edge addresses if the mismatch recurs.

Pages refreshes the gallery on each website deployment, including a daily scheduled run and manual workflow dispatches. The build reads the public gallery proxy and writes only the title, short description, and proxy cover URL for up to twelve games to `gallery.json`. Browser requests to the proxy are for cover images. An unavailable or empty catalog falls back to labeled example games.

For self-hosting, run `python3 website/build.py --refresh-gallery` and serve `website/dist` using the nginx example. Run without the flag or use the `joiner-website` CI artifact to preview with examples. Deploy each version to a separate directory and switch the hosting document root or current symlink only after approval. Keep the previous site directory for rollback. The website queries GitHub for Joiner downloads and needs no GameVault server credentials.
