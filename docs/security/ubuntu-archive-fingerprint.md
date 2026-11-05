# Public Ubuntu Archive signing fingerprint

The native scanner source lock records the public fingerprint of the Ubuntu
Archive Automatic Signing Key (2018), used to verify the distribution metadata
for the pinned bubblewrap package:

`F6ECB3762474EDA9D21B7022871920D1991BC93C`

This is an identifier of a publicly distributed verification key. It is not
private key material, an API credential, or an authorization token. Possession
of the fingerprint does not permit creating an accepted archive signature.

The retained verification checked the signature of Ubuntu's
[stonking InRelease metadata](https://archive.ubuntu.com/ubuntu/dists/stonking/InRelease)
with the Ubuntu archive keyring. The signed release identifies the SHA-512 hash
of the package index, and that index identifies the SHA-512 hash of the
`bubblewrap` version `0.12.0-1` package. Both hashes were verified before deriving
the separate SHA-256 pin used by the builder. The package is listed in
[Ubuntu's official package index](https://packages.ubuntu.com/stonking/bubblewrap).

Gitleaks 8.30.1 classified this public fingerprint as `generic-api-key` because
the JSON metadata field is named `distribution_signature_key`. Its detection
does not indicate that secret signing material was committed.

The configuration dispositions only the exact detected field/value pair in
`.github/security/native-scanner.json`, and only for `generic-api-key`. The path
also recognizes the scanner's existing temporary source-copy prefix. All
conditions must match; no file, directory, history interval, or other scanner
rule is excluded. The default rule set and full reachable-history and source
scans remain enabled.

Real-scanner negative controls verify that changed values, credential fields,
field prefixes/suffixes, other paths, nested paths, adjacent credentials and
provider-specific detections remain outside the exception. This disposition
does not establish the safety of other values or future changes to the lock.
