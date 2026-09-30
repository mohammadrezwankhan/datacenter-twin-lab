# Static site response policy

The Cloudflare Pages bundle includes `_headers`. It applies HSTS for one year
with `includeSubDomains` and the `preload` directive, same-origin framing,
MIME sniffing protection, a strict-origin referrer policy, and disabled camera,
microphone and geolocation permissions. The directive alone does not register
the domain in a browser's HSTS preload list.

The Content Security Policy permits the site's own assets and worker/blob
resources. Pyodide, NumPy and SciPy are hosted on the same origin; no CDN
allowlist is needed. `unsafe-eval` supports the pinned Python/Emscripten runtime;
inline styles support React configuration colors and the printable static notes.
Inline executable scripts are forbidden. The build hashes the original inline
JSON-LD metadata and allows only those exact contents. Objects are disabled;
base URLs, forms and ancestor frames are restricted to the same origin.

`security-headers.ts` generates this policy from the final built HTML and rejects
unreviewed inline scripts or Cloudflare header lines over 2,000 bytes. The Vite
demo preview applies the built policy, so browser tests exercise Python workers,
exports, charts and course navigation under the production restrictions. The
full Cloudflare artifact and the legacy GitHub Pages forwarding artifact remain
separate; Pages forwarding has its own executable redirect script.

After deploying, inspect actual response headers and test the optional Python
paths again. A missing header, blocked worker or CSP console violation fails
delivery. These controls reduce specific browser risks; they are not a security
certification. Similarly, automated accessibility checks and correct landmarks
are useful evidence, not a claim of complete WCAG conformance.

Primary references checked 1 October 2026:

- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [CSP script sources and hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)
