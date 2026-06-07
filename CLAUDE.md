# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-file Node.js Express app that generates encoded redirect links and logs visitor IP, geolocation, and device info. Runs on port 6262.

## Commands

```bash
# Install dependencies
npm install

# Run locally
node app.js

# Docker build & run
docker-compose up -d --build

# Docker stop
docker-compose down
```

There are no tests, linting, or type-checking configured.

## Architecture

Single-file Express app (`app.js`, ~470 lines). No routing modules, no database — everything is inline.

- **`GET /`** — Homepage with link generator UI. If `?k=<encoded_url>` param present, logs the visit and redirects.
- **`GET /make?url=`** — Returns an encoded redirect link for the given URL.
- **`GET /log`** — Visit log viewer (HTML table). Target URLs are hidden behind a password gate.
- **`POST /check-pwd`** — Validates password to reveal a specific target URL.
- **`POST /clear-log`** — Password-protected log clearing.

**Data storage:** File-based JSON (`visits.json`). Each entry: `{time, ip, location, device, target}`. Read/written via `fs.promises`, no concurrent-write protection.

**URL encoding:** Custom base64url (no padding, `+`→`-`, `/`→`_`). `encodeUrl()`/`decodeUrl()` in `app.js:75-87`.

**IP detection:** Reads `x-forwarded-for` header first, falls back to `remoteAddress`. Strips IPv6-mapped prefix (`::ffff:`). Private IPs return "局域网" without querying external API.

**Geolocation:** Calls `http://ip.plyz.net/ip.ashx?ip=<ip>` with 3s timeout. Response format is pipe-delimited (`something|<location>`).

**Time handling:** All timestamps forced to Beijing time (UTC+8) via manual offset calculation in `getBeijingTime()`.

## Docker

- Node 20 Alpine base image
- Timezone set to `Asia/Shanghai` at both Dockerfile `ENV` and compose `environment` level
- `visits.json` mounted as a volume for persistence across container restarts

## Security Notes

- The log-viewing password (`admin123`) is hardcoded in `app.js` line 10.
- The `/make` endpoint trusts `req.protocol` to generate links — behind a reverse proxy without proper `X-Forwarded-Proto` headers, this will generate `http://` links instead of `https://`.
- No rate limiting, no input sanitization beyond basic null checks on the redirect flow.
