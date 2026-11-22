# Deployment

## Read-only inspection

The running backend reports **17.0.1** from its package and local health API. The installed code recognizes both registration flags and assigns ordinary signups the User role, with admin exceptions for initial setup and the configured recovery username. Registration is enabled and the activation override is unset. Docker publishes port 8080 on all IPv4 and IPv6 interfaces. No service is listening locally on 80 or 443. Both intended public names returned NXDOMAIN through a public DNS resolver. External reachability of port 8080 is unverified.

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

Build with `python3 website/build.py` or retrieve the `joiner-website` CI artifact. Review the nginx example and serve the three generated static files behind HTTPS. Deploy each version to a separate directory and switch the hosting document root or current symlink only after approval. Keep the previous site directory for rollback. The website queries GitHub for Joiner downloads and needs no GameVault server credentials. It can be staged privately before setting DNS or enabling public access.
