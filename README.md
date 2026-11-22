# PND26 Extras Index

Static GitHub Pages catalogue and remote extras manager. It runs at `https://extras.nationdex.com` without a backend of its own.

## Connect an instance

Enter the instance's HTTPS origin and an API token created by the bot owner with `/api token` in Discord. The instance must allow this site's exact origin in its panel settings and implement:

- `GET /v1/extras` → `{ "extras": [{ "id": "example", "ref": "<commit SHA>" }] }`
- `POST /v1/extras/install` with `{ "id": "example", "ref": "<commit SHA>" }`
- `POST /v1/extras/remove` with `{ "id": "example" }`

Requests use `Authorization: Bearer <token>`. Credentials stay in page memory, are cleared from the password input after connecting, and are discarded on disconnect or reload. They are never sent to GitHub or stored in localStorage. The bot validates host approval, owner-token ownership, pinned commit, compatibility manifest, and installation contents itself. Installation runs code on the bot's host; the site asks for confirmation before changes.

Before connecting, the site checks public `GET /v1/discovery` metadata to confirm that the instance identifies as Project Nationdex 2026 and supports extras protocol version 1.

The API token is a high-privilege owner credential. Keep it private and disconnect when finished. Do not paste a Discord bot token. A connection requires a running, reachable instance and is not available offline.

## Submit an extra

Add a reviewed entry to `data/extras.json` and submit a pull request:

```json
{
  "id": "example",
  "repo": "https://github.com/yourusername/your-extra",
  "branch": "main",
  "ref": "<reviewed 40-character commit SHA>"
}
```

`branch` controls display metadata lookup; `ref` controls remote installation. The instance independently checks the requested pin against its trusted catalogue. Entries without a valid pinned commit remain discoverable but cannot be installed remotely. The existing `ndscript` entry currently has no verified pin and remains unavailable for remote installation.

The catalogue does not accept an arbitrary repository supplied by a browser. Removing an extra preserves its data; runtime activation or removal may require a bot restart, as reported by the instance.

## Frontend assets

Existing Alpine.js, Tailwind browser runtime, and highlight.js scripts are vendored in `vendor/` so scripts from a third-party CDN do not execute in the page containing an instance credential. Their original sources and versions are recorded in `vendor/README.md`. Fonts and stylesheets are still loaded from their existing providers.
