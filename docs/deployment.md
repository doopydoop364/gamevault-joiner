# Deployment

## Read-only inspection

The accessible Compose file at `/opt/gamevault/compose.yaml` declares `phalcode/gamevault-backend:latest` and `postgres:18`. It publishes host port 8080 with no host address specified and sets `SERVER_REGISTRATION_DISABLED=false`. It does not explicitly set the activation flag and has explicit game and media mounts. That is the declared configuration. The running image digest and version, active settings, external port reachability, reverse proxy, and firewall remain unverified because this session cannot query the Docker socket or resolve the public domains.

## Proposed settings and proxy

The [current GameVault configuration reference](https://gamevau.lt/docs/server/configuration/) documents both registration flags. Verify that the exact running backend version supports them before approval. Check the deployed release tag and image digest, the version in the Admin page, and runtime configuration precedence, including any mounted configuration or secret overrides. Verify GameVault’s demo mode is off and login attempt limiting is still effective at the proxy boundary. The first account on an empty installation gets administrator access automatically. Confirm a legitimate administrator already exists before allowing public registration. Activate new accounts with the default **User** role. Guest, inactive and anonymous users must be denied game downloads. See [upstream user management](https://gamevau.lt/docs/server/user-management/).

The prepared Compose override is for a host-local proxy and replaces the port mapping with loopback-only access. If the existing proxy is on another host, agree on a private-only bind and ACL for the proxy before applying a change. Do not replace the entire Compose file or move data. Keep PostgreSQL private. Use the exact production image digest during a settings-only recreate to avoid an accidental upgrade from the floating `latest` tag.

The example nginx virtual hosts preserve HTTPS and pass web/API traffic and WebSocket upgrades, with streaming responses. Integrate the relevant settings into the existing proxy after inspecting it. The GameVault example assumes nginx is the first trusted hop. When it sits behind a CDN, use that CDN’s verified real-IP configuration before relying on forwarded client IP for throttling. Keep backend role checks and any current rate limits. Avoid exposing operational dashboards, health details, debug middleware, or Swagger endpoints beyond administrative need. Preserve any intentional administration access and verify the exact routes against the running version.

## Approval, backup and rollback

1. Capture the running image digests, resolved volume mappings, existing public proxy configuration and certificate references. Store resolved configuration in a restricted backup location because it can contain credentials.
2. Make a PostgreSQL logical backup with the matching major version’s `pg_dump -Fc`. Back up the Compose and secret references, game files, media and any additional writable GameVault mounts or container state. Test restore to an isolated database and verify record counts and representative data.
3. Review the proposed configuration difference, planned downtime, loopback or private routing, and exact rollback commands. Obtain explicit approval before any live change, DNS update, firewall edit or service exposure.
4. Validate the merged Compose configuration with `docker compose ... config --quiet` and the integrated proxy with `nginx -t`. Recreate only the GameVault service if needed with the existing image. Test the reverse-proxy path before switching traffic.
5. Check public HTTPS and certificate validation. Test Web UI and API login, WebSocket traffic where used, streaming and range requests, pending activation, disabled-account access, login rate limiting, and approved User downloads with designated test accounts. Verify the bare backend port is unreachable from outside the trusted network. Check expected health and latency from monitoring without logging passwords, tokens, or download URLs.
6. On regression, restore the prior Compose and proxy files, validate them, then recreate the affected service with its prior pinned image and reload the previous proxy configuration. Restore database or persistent files only if they were actually affected, using the tested backup procedure.

## Website

Build with `python3 website/build.py` or retrieve the `joiner-website` CI artifact. Review the nginx example and serve the three generated static files behind HTTPS. Deploy each version to a separate directory and switch the hosting document root or current symlink only after approval. Keep the previous site directory for rollback. The website queries GitHub for Joiner downloads and needs no GameVault server credentials. It can be staged privately before setting DNS or enabling public access.
