# Deploy the static course on a custom domain

The browser course needs static HTTPS hosting only. Calculation, scenario editing and optional Python verification run on the visitor's device. A domain change does not require a simulation server, database or additional runtime service.

## Use the tested artifact

Build and test using the [browser-demo instructions](browser-demo.md). Publish the contents of `.local/browser-demo-site`, preserving its directory structure. The build uses relative asset paths. Both workers resolve their scenario and runtime assets relative to their own deployed URL, so the same artifact works at `/` and `/datacenter-twin-lab/`.

The Pages workflow tests the full course at the repository subpath, then checks the canonical 100/50 kWh guide, complete JavaScript/native/Python results and versioned evidence at `/`. The two runs retain separate reports. The loopback dashboard packaged in the Python wheel keeps its existing root configuration.

## Connect an existing domain to GitHub Pages

1. Inspect the domain's current DNS records and preserve unrelated mail and verification records. Nameservers select a DNS provider; they are not website addresses. A registrar screen that edits nameservers alone cannot add an A or CNAME record.
2. Verify domain ownership in the GitHub account when DNS access is available. Add the chosen custom domain in the repository's **Settings → Pages** before pointing DNS to GitHub.
3. In the authoritative DNS editor, point a subdomain's CNAME to `mohammadrezwankhan.github.io` without the repository path. If the name is the apex of a delegated DNS zone, use GitHub's documented apex A/AAAA or ALIAS records instead. Replace conflicting web records, preserve unrelated records and avoid wildcard entries.
4. Wait for GitHub's DNS check and certificate issuance, then enforce HTTPS. Check the canonical host, HTTP redirect, former Pages URL and direct lesson links. Do not declare the migration complete while DNS or the certificate is pending.
5. Run the guide at both reserves, request optional Python verification and open the evidence hub on the deployed domain. Update current entry links and social metadata after the new address works. Historical release assets and recorded receipts remain unchanged.

With this repository's custom Actions deployment, GitHub stores the custom domain in Pages settings; a source `CNAME` file is not required. DNS management access is separate from GitHub repository access. Reuse an existing DNS provider rather than purchasing hosting merely to serve this static application.

Primary references, checked 27 September 2026: [GitHub custom-domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [GitHub domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), and [Vite relative base paths](https://vite.dev/guide/build.html#relative-base).

## Host the same artifact on Cloudflare Pages

Cloudflare Pages Direct Upload can serve the tested static bundle on the existing account's free plan. Upload only the browser artifact's contents, with `index.html` at the ZIP root. Do not upload a workspace, source-control database, private campaign records or the Python API server. Keep the complete artifact and its SHA-256 manifest for each deployment. Direct Upload projects use later direct uploads rather than switching to Git integration.

1. Select **Workers & Pages → Create application → Pages → Direct Upload**. Create the project and upload the tested browser ZIP. Verify its `pages.dev` URL before attaching a domain.
2. Add the intended hostname through the Pages project's **Custom domains** flow. For a separately delegated apex, add its zone on the same Cloudflare account, inspect imported records, and use the assigned Cloudflare nameservers at the existing registrar. For a subdomain held in another provider's zone, add that provider's CNAME to the Pages hostname. Registration can remain with the current provider.
3. Preserve unrelated records and any existing DNSSEC configuration. Confirm delegation and certificate issuance before redirecting or retiring an existing working host. Nameserver propagation and certificate activation are separate checks.
4. Compare anonymously fetched files with the uploaded manifest, then run both canonical reserves, optional Python verification, course and evidence links at the real hostname. Record the deployment URL, source revision, time and tested manifest. Publish the custom-domain URL as the primary entry point only after it works over HTTPS.

The optional Python runtime is served as static assets. There are no Pages Functions, paid Workers, database, physical controls or client analytics in this application. A hosting account's plan label does not establish the status of a custom domain or a successful deployment.

Primary references, checked 27 September 2026: [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [Cloudflare custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
