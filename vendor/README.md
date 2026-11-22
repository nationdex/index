# Vendored existing frontend scripts

These replace the script CDN references already used by the index. No package manager dependencies were added. The copies are served from the same deployment as the connection UI.

- `alpine.js`: Alpine.js 3.14.9, MIT, https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js
- `tailwind.js`: existing Tailwind browser runtime, downloaded from https://cdn.tailwindcss.com on 2026-11-21, MIT. This is the existing runtime retained for compatibility; replacing it with generated CSS is a separate optimization.
- `highlight.js`: highlight.js 11.9.0, BSD-3-Clause, https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js
