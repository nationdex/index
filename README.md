# Nationdex Extras Index

Browse community extras at [extras.nationdex.com](https://extras.nationdex.com).

## Connect your bot

Enable remote extras in your bot's admin panel, add the website's origin, and approve the repositories and commits you trust. Create an API token with `/api token` in Discord and enter your bot's HTTPS address and token on the website.

Extras run with your bot's privileges. Review each extra before approving it. Installation and removal take effect after a bot restart.

## Submit an extra

Add an entry to `data/extras.json` and open a pull request:

```json
{
  "id": "example",
  "repo": "https://github.com/yourusername/your-extra",
  "branch": "main",
  "path": "extras/example",
  "ref": "<reviewed 40-character commit SHA>"
}
```

`path` is optional: omit it for a standalone repository, or set it to the extra folder in a monorepo. Use normal slash-separated folder names without traversal, encoded characters or backslashes. The bot owner approves this folder in the panel; the browser sends only the extra ID and commit to installation routes. Package metadata and unpacked-size estimates refer to that folder.

The current loader requires a `nationdex.extra.json` with `id`, `apiVersion: 1`, and `entrypoint`. The entrypoint must export `register(client)`. A commit SHA is required for remote installation. Bot owners approve each repository and commit in their own panel.

## Development

The site uses static HTML, CSS, and JavaScript. Serve the repository root with any static file server to preview it. After changing `assets/index.js`, update its SHA-256 hash in both the Content Security Policy and the script’s `integrity` attribute in `index.html`. The Example tab loads its templates from `assets/examples.json`.
