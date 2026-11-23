"""Refresh the HTML's module CSP/SRI hashes after reviewing assets/index.js changes."""
from pathlib import Path
import base64
import hashlib
import re

root = Path(__file__).resolve().parent.parent
source = (root / 'assets/index.js').read_bytes()
digest = 'sha256-' + base64.b64encode(hashlib.sha256(source).digest()).decode('ascii')
page = root / 'index.html'
html = page.read_text()
html, csp = re.subn(r"script-src '[^']+'", "script-src '" + digest + "'", html)
html, sri = re.subn(r'(src="assets/index.js" integrity=")[^"]+', r'\g<1>' + digest, html)
if csp != 1 or sri != 1:
    raise SystemExit('Expected exactly one module CSP rule and integrity attribute.')
page.write_text(html)
