# PND26 Extras Index

Static GitHub Pages catalogue and remote extras manager. It runs at `https://extras.nationdex.com` without a backend of its own.

## Connect an instance

Enter the instance's HTTPS origin and an API token created by the bot owner with `/api token` in Discord. The instance must allow this site's exact origin in its panel settings and implement:

- `GET /v1/extras` → `{ "extras": [{ "id": "example", "ref": "<commit SHA>" }] }`
- `POST /v1/extras/install` with `{ "id": "example", "ref": "<commit SHA>" }`
- `POST /v1/extras/remove` with `{ "id": "example" }`

Requests use `Authorization: Bearer <token>`. Credentials stay in page memory, are cleared from the password input after connecting, and are discarded on disconnect, page exit, or 15 minutes without activity. They are never sent to GitHub or stored in localStorage. The bot validates host approval, owner-token ownership, pinned commit, compatibility manifest, and installation contents itself. Installation runs code on the bot's host; the site asks for confirmation before changes.

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

`ref` controls remote installation and display metadata lookup for pinned entries; `branch` supplies display metadata only when no pin exists. The instance independently checks the requested pin against its trusted catalogue. Entries without a valid pinned commit remain discoverable but cannot be installed remotely. The existing `ndscript` entry currently has no verified pin and remains unavailable for remote installation.

The catalogue does not accept an arbitrary repository supplied by a browser. Removing an extra preserves its data; runtime activation or removal may require a bot restart, as reported by the instance.

## Frontend

Native CSS and browser JavaScript; no framework, CSS compiler, third-party browser dependencies, package installation or build step. All styles and scripts are served locally. The catalogue retrieves GitHub package metadata as data, never executable code.

The interface preserves catalogue search, tabs, theme switching, code examples, and remote install/update/remove operations. The manager only opens in a top-level tab. Use a current browser with ES modules, CSP external script hashes, AbortSignal.timeout and AbortSignal.any support.

## Security and development

See [the audit and deployment limits](security/walkthrough.md) and [the GitHub advisory snapshot](security/dependency-alerts.json). Repository protection and bot-side authorization remain necessary; a frontend cannot make a compromised deployment safe for owner credentials.

Run the security checks:

```sh
python3 tests/update-integrity.py
node --test tests/security.test.js
```

The module is authorized by an exact CSP hash and a matching integrity attribute. After reviewing a change to `assets/index.js`, refresh both and rerun the security check:

```sh
python3 tests/update-integrity.py
python3 tests/update-integrity.py
node --test tests/security.test.js
```

Serve the root as static files for local preview. `tests/browser-security.mjs` exports a Playwright audit function for a page pointed at localhost:8765, using mock endpoints and a dummy token. No real instance is required. CI checks source integrity and the unit security invariants; browser verification is recorded in the audit.
