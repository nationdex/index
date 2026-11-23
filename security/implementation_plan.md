# Index security implementation plan

## Security Threat Model

The static GitHub Pages site accepts an owner API credential and sends it only to a user-selected HTTPS bot origin. Catalogue entries, GitHub package metadata, API responses, browser storage, and asynchronous completions are untrusted. A compromised deployment or browser can still misuse a credential; client-side controls do not sandbox installed extras.

Priority boundaries: remote text to DOM, credential to network destination, old connection to current connection, installation confirmation to approved commit, and framed page to privileged user action.

## Verification Plan

Remove browser libraries and runtime compilation; use native CSS, ES modules, safe DOM construction, restrictive CSP, same-origin static assets and integrity checks. Validate catalogue, metadata, response sizes, URLs and API response schemas. Abort and invalidate stale connections; clear credentials on disconnect, page exit and idle timeout. Never install automatically.

Run native JavaScript unit tests and browser proofs for hostile metadata, rejected repositories, redirect behavior, disconnect/connect races, CSP, framing, tab/theme behavior, installation confirmation and mobile layout. Query advisories and reconcile GitHub dependency alerts. SecureCoder scanner discovery is attempted; if absent, report it unavailable rather than claiming a scan passed. Record residual deployment and host isolation risks in the audit.
