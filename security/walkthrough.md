# Extras index security audit

Review date: 2026-11-23 UTC (2026-11-22 in São Paulo).
Scope: `nationdex/index`, its HTML, JavaScript, CSS, catalogue and examples, current GitHub Actions configuration, GitHub Pages configuration and live response headers. Bot/API/ForgeScript implementations are trust boundaries, not a completed host security audit.

Status: local remediation and Chromium verification completed; not deployed. See [the threat model](implementation_plan.md). No claim of universal vulnerability freedom is made.

## Method and limitations

Manual source and data-flow review, direct OSV version queries, npm release metadata, upstream GitHub advisories, authenticated Dependabot alert retrieval, source integrity tests, adversarial Chromium tests and live header/configuration inspection were performed. SecureCoder was unavailable: neither its sidecar nor its API-port environment variable was present. No automated SecureCoder/SAST pass is claimed. There was no destructive test of production, real credential use, live extra installation, full Git history secret scan, browser extension review, or infrastructure penetration test. Browser verification used Chromium; Firefox/Safari were not exercised.

## Dependency disposition

| Previous browser dependency | Previous version | Registry latest observed | Final disposition |
| --- | --- | --- | --- |
| Alpine.js | 3.14.9 | 3.17.5 | Removed; native tab/theme handlers |
| highlight.js | 11.9.0 | 11.12.0 | Removed; inert source text in code blocks |
| Tailwind browser compiler | 3.4.17 | Tailwind CSS 4.3.5 | Removed; native CSS variables, flexbox/grid and media queries |
| Remix Icon stylesheet/font | 4.6.0 | 4.9.1 | Removed; labelled controls/links |
| Google Fonts | Remote dynamic stylesheet | Not a versioned package | Removed; system fonts |

There are zero third-party browser libraries or CDN assets, no package installation, no CSS compiler, and no build step. GitHub metadata is still fetched as bounded JSON/text, never as executable code. The source examples are data, not imported code. This removes the browser dependencies rather than retaining outdated copies or adding another CSS framework. The four queried exact package versions returned no OSV advisories; this was not a complete SBOM of the old Tailwind compiler.

GitHub Actions still uses pinned actions: checkout v7.0.1 (verified current upstream release) and setup-bun at a full commit SHA. Bun 1.4.5 runs the dependency-free tests. These are CI tools, not page runtime scripts. CI has read-only repository permissions and does not execute catalogue repository code.

Previous HTML plus three vendored scripts: 607,634 uncompressed bytes. The replacement HTML/CSS/JS/example JSON is 31,379 uncompressed bytes (94.8% smaller). Compare like-for-like source bytes rather than compressed network transfer; the shared logo is excluded. Documentation, test fixtures and audit evidence are excluded from this runtime comparison.

## Findings and remediations

Severity below is qualitative review priority, not an assigned CVSS score. Missing defense-in-depth controls are not presented as independently demonstrated remote code execution.

| ID | Priority | Finding | Disposition and evidence |
| --- | --- | --- | --- |
| IDX-01 | High consequence, conditional | Any script running in the credential page can intercept/use an owner token. Memory-only storage is not an XSS defense. | Reduced exposure: removed third-party runtime code, eval-dependent templates and external styles/fonts; module executes in private scope; exact script hash in CSP and SRI. A compromised deployment can replace policy and code together: residual architectural risk. |
| IDX-02 | Medium | Missing script restrictions and dangerous HTML sinks increased the impact of a future rendering mistake. | Fixed in local source: default-deny CSP, exact module hash, no inline script/eval permission, Trusted Types requirement with no policy creation, no HTML-string sinks. Chromium rejected adversarial HTML/script assignments. Unsupported Trusted Types implementations still receive safe DOM rendering and CSP. |
| IDX-03 | Medium | Index could be framed while displaying privileged controls. | Mitigated: app is hidden by default; module checks top-level context before showing controls or sending requests. Framed Chromium test passes. This does not supply server-side frame-ancestors/X-Frame-Options; edge protection remains recommended. |
| IDX-04 | Medium | Overlapping discovery/connect requests could overwrite the selected connection after disconnect/reconnect. | Fixed: generation checks, abort controllers, captured connection identity and stale-result guards; cancelled first discovery receives no token in browser test. A POST already dispatched before disconnect may still complete on the bot; UI explicitly reports uncertain outcomes. |
| IDX-05 | Medium | Unbounded/malformed API and metadata responses could consume resources or break rendering. | Fixed: streamed decoded-body byte limits, timeouts, MIME checks, schema/count/field bounds and UTF-8/JSON parsing. All requests reject redirects and omit cookies/referrer. Only GitHub raw metadata explicitly permits text/plain JSON. |
| IDX-06 | Low | GitHub URL matcher accepted a GitHub substring in an unrelated host/path. | Fixed: HTTPS URL parser, exact github.com hostname, no credentials/query/fragment/port, validated owner/repository components. Deceptive-host tests pass. |
| IDX-07 | Low | Metadata and catalogue types/identifiers were inconsistently validated. | Fixed: bounded typed catalogue, unique IDs, full commit pins, branch segment validation, typed package metadata, validated installed state. All remote strings are rendered as text nodes. Invalid catalogue fails closed. |
| IDX-08 | Low | Open tab retained credentials indefinitely until explicit disconnect/reload. | Fixed: 15-minute inactivity timer, pagehide cleanup, aborted pending requests and cleared password field. Browser timer test passes. JavaScript strings cannot be securely zeroed; revocation is a server responsibility. |
| IDX-09 | Low | Installation UI could obscure the destination or pending disabled state. | Fixed: confirmation contains selected HTTPS origin, canonical extra ID and full commit; disabled extras show removal-pending state. Connect does not install; cancelling confirmation sends no POST. Metadata for pinned extras now comes from the pinned commit. |
| IDX-10 | Low | CI tested file presence only; vendored runtime dependencies had no update automation. | Fixed: runtime libraries removed; CI now runs security invariant tests, including CSP/SRI/source consistency. Pinned GitHub Actions remain monitored by Dependabot. |
| IDX-11 | Low | Referrer and CDN/font requests increased third-party exposure. | Fixed: no remote styles/fonts/scripts; no-referrer page policy and explicit fetch policy. Only theme preference uses storage. Token is absent from cookies, sessionStorage and localStorage in the browser test. |

No confirmed critical application vulnerability was demonstrated in this index audit. These fixes should not be described as repairs for the 8 critical Python dependency alerts below.

## CVE and advisory assessment

- [CVE-2020-26237 / GHSA-vfrc-7r7c-w9mx](https://github.com/advisories/GHSA-vfrc-7r7c-w9mx): highlight.js prototype pollution; affected before 9.18.2 and 10.x before 10.1.2. Previous 11.9.0 was outside the affected ranges. The library is now removed.
- [GHSA-7wwv-vh3v-89cq](https://github.com/advisories/GHSA-7wwv-vh3v-89cq): grammar ReDoS; affected versions were patched in 10.4.1. Previous 11.9.0 was outside the affected range. The library is now removed.
- A search result referenced a newer LiveScript grammar issue. Its affected range could not be independently established during review; it was not reported as a confirmed exploitable CVE. No highlighter remains in the replacement page.
- [OSV](https://osv.dev/) exact-version API queries for alpinejs 3.14.9, highlight.js 11.9.0, tailwindcss 3.4.17 and remixicon 4.6.0 returned no matches at review time. No-match results do not certify safety.

The complete authenticated GitHub alert snapshot is in [dependency-alerts.json](dependency-alerts.json): 97 open alerts, consisting of 8 critical, 61 high, 27 medium and 1 low. All identify `uv.lock`. Package totals: Pillow 56, GitPython 33, urllib3 3, anyio 2, starlette 2, certifi 1. Individual GHSA/CVE identifiers, provider CVSS scores/vectors, affected ranges and first patched versions are preserved exactly as supplied by GitHub. Null provider data remains null; no score is invented.

The current default branch is main and contains no uv.lock, Python application, Python installation workflow or Python runtime dependency manifest. None of those packages executes in this static browser deployment. Their correct disposition here is "not installed in the reviewed tree; graph reconciliation needed", not "patched by updating JavaScript". Alerts remain open and were not silently dismissed. If another deployment still consumes the historical Python application, its lockfile and runtime need a separate update and audit.

## Verification results

`bun test tests/security.test.js`: 7 tests and 37 assertions passed. Tests cover deceptive repositories, catalogue limits/pins/types, instance origins, metadata types/schemes, installed response validation, fetch MIME/size/redirect rejection, and exact CSP/SRI consistency.

`tests/browser-security.mjs`: 21 checks passed in Chromium with controlled HTTPS route fixtures and a dummy token. Hostile metadata did not create img/svg/onerror elements or execute. Trusted Types blocked HTML and script string assignment. Tabs/examples/theme worked. Cancelled first connection received no token; discovery was credential free. Token input cleared; connect/cancelled confirmation sent no mutation. Confirmed installation used the intended origin and SHA; removal used the fixed endpoint. Credentials were absent from browser storage. Idle expiry and disconnect removed privileged controls. A 375px viewport had no horizontal overflow. Framed manager failed closed. No uncaught JavaScript exceptions occurred. Expected console policy violations from the adversarial Trusted Types probes are not application failures.

Browser mocks prove UI/request invariants, not backend authorization. The test uses a synthetic confirmation decision to exercise accept/cancel paths. No real bot was changed.

## Remaining trust and deployment boundaries

1. A credential can only be sent safely to an address the owner actually controls. Discovery metadata identifies protocol compatibility; it is not proof of ownership. A malicious HTTPS server can advertise the same product. The UI states this explicitly.
2. A compromised GitHub account, deployment workflow, DNS configuration, browser or extension can defeat frontend protections. Exact-hash CSP/SRI protects against some injection and accidental asset changes, not an attacker who can rewrite the HTML and its hashes.
3. connect-src permits HTTPS destinations because owners supply arbitrary bot origins. This is needed for remote dex instances and is not an exfiltration boundary after JavaScript compromise.
4. GitHub Pages currently enforces HTTPS and deploys from main root. Its live response lacked CSP/X-Frame-Options; the replacement supplies a meta CSP but cannot add frame-ancestors there. A controlled reverse proxy/CDN should send `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and an appropriate Permissions-Policy. Do not add a `_headers` file and claim GitHub Pages applies it. Account-level deployment settings were not changed.
5. Extras run with host privileges. API-side owner checks, pinned repository approval, request limits, revocation and operating-system service isolation remain necessary. This website cannot sandbox an installed extra or turn an owner token into a restricted token.
6. Revoking browser state cannot cancel a write already received by the server. Disconnection/timeout does not imply rollback; reconnect and inspect state before retrying.
7. Changes are local until committed and deployed. Recheck production headers, integrity/CSP loading and browser behavior after deployment. Files must be deployed atomically; mismatched HTML and script hashes intentionally stop the manager from opening.

## Maintenance and reproduction

Run `bun test tests/security.test.js`. After reviewed module changes, run `python3 tests/update-integrity.py` and rerun tests. Serve the repository at localhost:8765 and invoke the exported browserAudit function from tests/browser-security.mjs with a Playwright Page. The browser fixture requires no runtime package or production credentials. An external Playwright harness is a development tool and is not shipped as a website dependency.

Sources: [CSP script hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), [frame-ancestors limitations](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors), [Alpine expression evaluation](https://www.alpinejs.dev/advanced/csp), [GitHub alert handling](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-dependabot-alerts/view-dependabot-alerts), upstream advisory URLs above, direct npm registry metadata and GitHub repository API observations.
