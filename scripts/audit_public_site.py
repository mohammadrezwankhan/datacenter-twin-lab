#!/usr/bin/env python3
"""Audit Datacenter Twin Lab's public crawl graph and v2 evidence bytes.

Read-only GET requests only. No tokens or third-party packages are required.
Use --strict-seo for release gating. The status JSON always records provenance.
"""
from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET

DEFAULT_BASE = 'https://khanlab.co.technology/'
PACKET = '/data/evidence/v2.0.0/'
SEEDS = ('/', '/learn/', '/about/', '/evidence/', '/studies/emt/')
BOTS = ('GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended')
# The Python reference stores 100-decimal-digit exports. This tolerance is
# larger than its packet verifier's 1e-90 tolerance but far below display precision.
LEDGER_TOLERANCE = Fraction(1, 10**85)
MAX_BYTES = 16 * 1024 * 1024
MAX_REDIRECTS = 10
# Retained engine evidence uses up to 100 significant digits and 198 decimal
# places. Bound external values before Fraction expands a decimal exponent.
MAX_NUMERIC_TEXT = 512
MAX_NUMERIC_EXPONENT = 512


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.ids: set[str] = set()
        self.canonical: list[str] = []
        self.meta: dict[str, str] = {}
        self.jsonld: list[object] = []
        self.lang: str | None = None
        self.h1_count = 0
        self.title = ''
        self.images_without_dimensions: list[str] = []
        self._title = False
        self._script = False
        self._script_text = ''

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'html':
            self.lang = a.get('lang')
        if tag == 'title':
            self._title = True
        if tag == 'h1':
            self.h1_count += 1
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        if tag == 'link' and 'canonical' in (a.get('rel') or '').split():
            self.canonical.append(a.get('href') or '')
        if tag == 'meta':
            key = a.get('property') or a.get('name')
            if key:
                self.meta[key.lower()] = a.get('content') or ''
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self._script = True
            self._script_text = ''
        if tag == 'img' and a.get('src') and not (a.get('width') and a.get('height')):
            self.images_without_dimensions.append(a['src'])

    def handle_data(self, data: str):
        if self._title:
            self.title += data
        if self._script:
            self._script_text += data

    def handle_endtag(self, tag: str):
        if tag == 'title':
            self._title = False
        if tag == 'script' and self._script:
            try:
                self.jsonld.append(json.loads(self._script_text))
            except json.JSONDecodeError:
                self.jsonld.append({'_malformed': True})
            self._script = False


def schema_types(value: object) -> set[str]:
    if isinstance(value, list):
        return set().union(*(schema_types(x) for x in value)) if value else set()
    if not isinstance(value, dict):
        return set()
    types = value.get('@type', [])
    found = {types} if isinstance(types, str) else set(types) if isinstance(types, list) else set()
    return found | schema_types(value.get('@graph', []))


def rational(value: object) -> Fraction:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError('Numeric value must be a finite decimal')
    text = str(value)
    if len(text) > MAX_NUMERIC_TEXT:
        raise ValueError('Numeric evidence exceeds the supported precision limit')
    try:
        number = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError('Numeric value must be a finite decimal') from exc
    if not number.is_finite() or abs(number.as_tuple().exponent) > MAX_NUMERIC_EXPONENT:
        raise ValueError('Numeric evidence exceeds the supported exponent limit')
    return Fraction(number)


def safe_packet_name(name: str) -> bool:
    path = PurePosixPath(name)
    return (path.name == name and name not in ('.', '..') and
            not name.startswith('.') and bool(re.fullmatch(r'[A-Za-z0-9_.-]+', name)))


def same_origin(a: str, b: str) -> bool:
    u, v = urlsplit(a), urlsplit(b)
    return u.scheme == v.scheme and u.netloc.lower() == v.netloc.lower()


def normalized_page(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path or '/', '', ''))


class _NoAutomaticRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _open_same_origin(request: Request):
    """Validate every redirect before I/O and discard redirect bodies unread."""
    origin = request.full_url
    parsed = urlsplit(origin)
    if (parsed.scheme not in ('http', 'https') or not parsed.hostname
            or parsed.username is not None or parsed.password is not None):
        raise ValueError('Audit URLs must use HTTP(S) without credentials')
    opener = build_opener(_NoAutomaticRedirects())
    for hop in range(MAX_REDIRECTS + 1):
        try:
            return opener.open(request, timeout=15)
        except HTTPError as exc:
            if exc.code not in (301, 302, 303, 307, 308):
                raise
            try:
                location = exc.headers.get('Location') or exc.headers.get('URI')
                if not location:
                    raise
                target = urljoin(request.full_url, location)
                if not same_origin(origin, target):
                    raise ValueError(f'Off-origin redirect blocked: {request.full_url} -> {target}')
                if hop == MAX_REDIRECTS:
                    raise ValueError('Audit redirect limit exceeded')
            finally:
                # urllib's default redirect handler reads the entire response
                # body before redirecting, outside default_fetch's byte limit.
                exc.close()
            request = Request(target, method=request.get_method(),
                              headers=dict(request.header_items()))


def default_probe(url: str) -> tuple[int, str]:
    """Validate linked downloadable assets without transferring large reports/PDFs.

    For servers rejecting HEAD, a one-byte ranged GET establishes reachability.
    A 206 status then means partial-content existence, not a full GET HTTP-200 test.
    """
    request = Request(url, method='HEAD', headers={'User-Agent': 'DatacenterTwinLab-ReadOnlyQA/1.0'})
    try:
        with _open_same_origin(request) as response:
            return response.status, response.geturl()
    except HTTPError as exc:
        if exc.code not in (405, 501):
            raise
        exc.close()
    request = Request(url, headers={'User-Agent': 'DatacenterTwinLab-ReadOnlyQA/1.0', 'Range': 'bytes=0-0'})
    with _open_same_origin(request) as response:
        return response.status, response.geturl()


def default_fetch(url: str) -> tuple[int, str, bytes, str]:
    request = Request(url, headers={'User-Agent': 'DatacenterTwinLab-ReadOnlyQA/1.0', 'Accept': '*/*'})
    with _open_same_origin(request) as response:
        size = 0
        parts = []
        while True:
            block = response.read(256 * 1024)
            if not block:
                break
            size += len(block)
            if size > MAX_BYTES:
                raise ValueError(f'Resource exceeds {MAX_BYTES} byte audit limit')
            parts.append(block)
        return response.status, response.geturl(), b''.join(parts), response.headers.get('Content-Type', '')


@dataclass
class Report:
    base_url: str
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = 'incomplete'
    checked_pages: list[str] = field(default_factory=list)
    checked_artifacts: dict[str, str] = field(default_factory=dict)
    checked_linked_files: list[str] = field(default_factory=list)
    lesson_pages: list[str] = field(default_factory=list)
    sitemap_pages: list[str] = field(default_factory=list)
    checks: dict[str, object] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    methodology: str = 'HTML crawl, same-origin link HEAD probes, and raw-byte SHA-256; NOT Lighthouse or a browser audit'

    def fail(self, message: str):
        self.failures.append(message)

    def note(self, message: str):
        self.warnings.append(message)


class SiteAudit:
    def __init__(self, base: str = DEFAULT_BASE, *, strict_seo: bool = False, max_pages: int = 200,
                 max_files: int = 500, catalog_path: Path | str | None = None, fetch=default_fetch, probe=default_probe):
        if not base.endswith('/'):
            base += '/'
        self.base = base
        self.strict_seo = strict_seo
        self.max_pages = max_pages
        self.max_files = max_files
        self.catalog_path = Path(catalog_path) if catalog_path else None
        self.fetcher = fetch
        self.prober = probe
        self.linked_files: set[str] = set()
        self.report = Report(base_url=base)
        self.pages: dict[str, PageParser] = {}
        self.objects: dict[str, object] = {}
        self.fetched: dict[str, bytes] = {}

    def seo_issue(self, message: str):
        (self.report.fail if self.strict_seo else self.report.note)(message)

    def get(self, url: str) -> bytes | None:
        if url in self.fetched:
            return self.fetched[url]
        if not same_origin(self.base, url):
            self.report.fail(f'Cross-origin fetch blocked: {url}')
            return None
        try:
            status, final, contents, content_type = self.fetcher(url)
            if status != 200:
                self.report.fail(f'HTTP {status}: {url}')
                return None
            if not same_origin(self.base, final):
                self.report.fail(f'Unexpected off-origin redirect: {url} -> {final}')
                return None
            self.fetched[url] = contents
            return contents
        except (HTTPError, URLError, OSError, ValueError, TimeoutError) as exc:
            self.report.fail(f'Cannot fetch {url}: {exc}')
            return None

    def crawl(self):
        todo = deque(urljoin(self.base, route.lstrip('/')) for route in SEEDS)
        seen: set[str] = set()
        while todo and len(seen) < self.max_pages:
            url = normalized_page(todo.popleft())
            if url in seen:
                continue
            seen.add(url)
            raw = self.get(url)
            if raw is None:
                continue
            page = PageParser()
            page.feed(raw.decode('utf-8', errors='replace'))
            self.pages[url] = page
            self.report.checked_pages.append(url)
            path = urlsplit(url).path
            if path.startswith('/learn/') and path != '/learn/':
                self.report.lesson_pages.append(url)
            if not page.lang:
                self.seo_issue(f'Missing html lang: {url}')
            if not page.title.strip():
                self.seo_issue(f'Missing title: {url}')
            if page.h1_count != 1:
                self.seo_issue(f'Expected one H1, got {page.h1_count}: {url}')
            if not page.canonical or len(page.canonical) != 1:
                self.seo_issue(f'Expected exactly one canonical: {url}')
            else:
                target = urljoin(url, page.canonical[0])
                if not same_origin(self.base, target):
                    self.seo_issue(f'Canonical leaves owner domain: {url} -> {target}')
                elif path.startswith('/learn/') and normalized_page(target) != url:
                    self.seo_issue(f'Lesson canonical does not identify itself: {url} -> {target}')
            for key in ('description', 'og:title', 'og:description', 'og:image', 'twitter:card'):
                if not page.meta.get(key):
                    self.seo_issue(f'Missing {key}: {url}')
            types = set().union(*(schema_types(x) for x in page.jsonld)) if page.jsonld else set()
            if any(isinstance(x, dict) and x.get('_malformed') for x in page.jsonld):
                self.seo_issue(f'Malformed JSON-LD: {url}')
            if path == '/' and 'SoftwareApplication' not in types:
                self.seo_issue(f'Expected SoftwareApplication schema: {url}')
            if path == '/learn/' and 'Course' not in types:
                self.seo_issue(f'Expected Course schema: {url}')
            if path.startswith('/learn/') and path != '/learn/' and not types.intersection({'LearningResource', 'TechArticle', 'Article'}):
                self.seo_issue(f'Expected lesson LearningResource/TechArticle schema: {url}')
            if path.startswith('/learn/') and path != '/learn/' and 'TechArticle' not in types:
                self.seo_issue(f'Expected lesson TechArticle schema: {url}')
            if page.images_without_dimensions:
                self.seo_issue(f'{len(page.images_without_dimensions)} img without intrinsic dimensions: {url}')
            for href in page.links:
                dest = urljoin(url, href)
                if not same_origin(self.base, dest):
                    continue
                path_dest = unquote(urlsplit(dest).path)
                if path_dest.startswith(PACKET) or path_dest.startswith('/data/'):
                    self.linked_files.add(normalized_page(dest))
                    continue
                if re.search(r'\.(?:html?|xml|txt|md|json|pdf|png|jpe?g|webp|avif|svg|woff2?|js|css|zip)$', path_dest, re.I):
                    if path_dest.lower().endswith(('.html', '.htm')):
                        todo.append(dest)
                    else:
                        self.linked_files.add(normalized_page(dest))
                    continue
                if len(seen) + len(todo) < self.max_pages * 3:
                    todo.append(dest)
        if todo:
            self.report.note(f'Crawl truncated at {self.max_pages} pages; remaining: {len(todo)}')
        if len(self.report.lesson_pages) < 24:
            self.seo_issue(f'Only {len(self.report.lesson_pages)} / 24 lesson pages discovered')
        # When running inside the repository, use the source-of-truth curriculum
        # instead of accepting any arbitrary collection of 24 pages.
        catalog = self.catalog_path
        if catalog is None and not urlsplit(self.base).netloc.lower().endswith('.invalid'):
            repo_catalog = Path(__file__).resolve().parents[1] / 'apps' / 'web' / 'src' / 'course-catalog.json'
            if repo_catalog.is_file():
                catalog = repo_catalog
        if catalog and Path(catalog).is_file():
            try:
                catalog_items = json.loads(Path(catalog).read_text(encoding='utf8'))
                expected = {normalized_page(urljoin(self.base, item['readingRoute'])) for item in catalog_items}
                self.report.checks['catalog_lessons'] = len(expected)
                for missing in sorted(expected - set(self.report.lesson_pages)):
                    self.report.fail(f'Course catalog lesson not linked/crawlable: {missing}')
            except (ValueError, TypeError, KeyError) as exc:
                self.report.fail(f'Cannot validate source curriculum catalog: {exc}')
        self.report.lesson_pages.sort()
        self.report.checked_pages.sort()
        self.report.checks['html_pages'] = len(self.report.checked_pages)
        self.report.checks['lessons_discovered'] = len(self.report.lesson_pages)

    def linked_assets(self):
        """Check referenced same-site downloadable files; do not fetch external origins."""
        files = sorted(self.linked_files)
        if len(files) > self.max_files:
            self.report.fail(f'Linked asset verification limit reached: {len(files)} > {self.max_files}')
        for url in files[:self.max_files]:
            if url in self.fetched:
                self.report.checked_linked_files.append(url)
                continue
            try:
                status, final = self.prober(url)
                if status not in (200, 206) or not same_origin(self.base, final):
                    self.report.fail(f'Linked file unreachable or redirected away: HTTP {status} {url} -> {final}')
                else:
                    self.report.checked_linked_files.append(url)
            except (HTTPError, URLError, OSError, ValueError, TimeoutError) as exc:
                self.report.fail(f'Broken same-site linked file: {url}: {exc}')
        self.report.checks['linked_files_checked'] = len(self.report.checked_linked_files)

    def sitemap(self):
        url = urljoin(self.base, 'sitemap.xml')
        raw = self.get(url)
        if raw is None:
            return
        try:
            root = ET.fromstring(raw)
            urls = []
            for entry in root.findall('.//{*}url'):
                loc = entry.findtext('{*}loc')
                lastmod = entry.findtext('{*}lastmod')
                if loc:
                    urls.append(normalized_page(loc))
                    if not same_origin(loc, self.base):
                        self.seo_issue(f'Sitemap off-origin: {loc}')
                    if not lastmod:
                        self.seo_issue(f'Sitemap missing lastmod: {loc}')
            self.report.sitemap_pages = sorted(set(urls))
            if not urls:
                self.seo_issue('No url entries found in sitemap.xml')
            missing = sorted(set(self.report.lesson_pages) - set(urls))
            for lesson in missing:
                self.seo_issue(f'Lesson absent from sitemap: {lesson}')
            self.report.checks['sitemap_urls'] = len(urls)
        except ET.ParseError as exc:
            self.report.fail(f'Invalid sitemap XML: {exc}')

    def robots(self):
        raw = self.get(urljoin(self.base, 'robots.txt'))
        if raw is None:
            return
        content = raw.decode('utf-8', errors='replace')
        if not re.search(r'(?im)^\s*sitemap\s*:', content):
            self.seo_issue('robots.txt lacks a Sitemap directive')
        for bot in BOTS:
            if not re.search(r'(?im)^\s*user-agent\s*:\s*' + re.escape(bot) + r'\s*$', content):
                self.report.note(f'No explicit {bot} robots block (this is a publisher policy choice)')

    @staticmethod
    def verify_ledger(run: dict) -> list[str]:
        issues = []
        sums = {key: Fraction(0) for key in (
            'requested_it_kwh', 'served_it_kwh', 'unserved_it_kwh',
            'grid_kwh', 'generator_kwh', 'battery_stored_change_kwh',
            'distribution_loss_kwh', 'battery_charge_loss_kwh', 'battery_discharge_loss_kwh')}
        for i, row in enumerate(run['intervals']):
            energy = {key: rational(row['energy'][key]) for key in sums}
            for key in sums:
                sums[key] += energy[key]
            delta = rational(row['battery_end_kwh']) - rational(row['battery_start_kwh'])
            req = energy['requested_it_kwh'] - energy['served_it_kwh'] - energy['unserved_it_kwh']
            supply = energy['grid_kwh'] + energy['generator_kwh'] - sum((energy[k] for k in (
                'served_it_kwh', 'battery_stored_change_kwh', 'distribution_loss_kwh',
                'battery_charge_loss_kwh', 'battery_discharge_loss_kwh')), Fraction(0))
            if abs(req) > LEDGER_TOLERANCE or abs(supply) > LEDGER_TOLERANCE or abs(delta - energy['battery_stored_change_kwh']) > LEDGER_TOLERANCE:
                issues.append(f'interval {i} violates exact energy partitions')
        req_total = sums['requested_it_kwh'] - sums['served_it_kwh'] - sums['unserved_it_kwh']
        if abs(req_total) > LEDGER_TOLERANCE:
            issues.append('whole-run IT requested partition mismatch')
        for metric in ('requested_it_kwh', 'served_it_kwh', 'unserved_it_kwh'):
            if abs(sums[metric] - rational(run['summary'][metric])) > LEDGER_TOLERANCE:
                issues.append(f'run.summary.{metric} disagrees with interval totals')
        return issues

    def verify_cases(self, manifest: dict, docs: dict[str, bytes]):
        for case in manifest.get('cases', []):
            name = case.get('case_id', '(unknown)')
            try:
                scenario = json.loads(docs[case['scenario_file']])
                run = json.loads(docs[case['run_file']])
                if run['scenario'] != scenario:
                    self.report.fail(f'{name}: scenario file differs from run scenario')
                if run['input_sha256'] != case['input_sha256']:
                    self.report.fail(f'{name}: run input SHA does not match manifest case')
                if run['run_id'] != case['run_id']:
                    self.report.fail(f'{name}: run ID does not match manifest case')
                if scenario['id'] != case['scenario_id']:
                    self.report.fail(f'{name}: scenario ID does not match manifest case')
                if case['input_sha256'] not in case['scenario_file'] or case['input_sha256'] not in case['run_file']:
                    self.report.fail(f'{name}: filenames omit input SHA')
                if case.get('ledger', {}).get('status') != 'pass':
                    self.report.fail(f'{name}: manifest ledger status is not pass')
                for msg in self.verify_ledger(run):
                    self.report.fail(f'{name}: {msg}')
                for check in case.get('checks', []):
                    if check.get('status') != 'match' or abs(rational(check['expected']) - rational(check['observed'])) > LEDGER_TOLERANCE:
                        self.report.fail(f'{name}: manifest check failed: {check.get("metric")}')
                if name.startswith('canonical-1mw-'):
                    start = next(rational(e['at_s']) for e in scenario['events'] if e['action'] == 'asset_down' and e['target'] == 'utility')
                    recover = next(rational(e['at_s']) for e in scenario['events'] if e['action'] == 'asset_up' and e['target'] == 'utility')
                    expected_duration = (rational(scenario['battery_initial_kwh']) * rational(scenario['battery_discharge_efficiency']) * rational(scenario['distribution_efficiency']) / rational(scenario['it_demand_kw']) * 3600)
                    actual_depleted = next(rational(e['at_s']) for e in run['events'] if e['action'] == 'battery_depleted')
                    if abs(actual_depleted - (start + expected_duration)) > LEDGER_TOLERANCE:
                        self.report.fail(f'{name}: independent ride-through event mismatch')
                    unserved = max(Fraction(0), recover - actual_depleted) * rational(scenario['it_demand_kw']) / 3600
                    if abs(rational(run['summary']['unserved_it_kwh']) - unserved) > LEDGER_TOLERANCE:
                        self.report.fail(f'{name}: independent unserved energy mismatch')
            except (KeyError, ValueError, StopIteration, TypeError, json.JSONDecodeError) as exc:
                self.report.fail(f'{name}: cannot verify run/scenario: {exc}')

    def evidence(self):
        prefix = urljoin(self.base, PACKET.lstrip('/'))
        raw = self.get(prefix + 'manifest.json')
        if raw is None:
            return
        try:
            manifest = json.loads(raw)
            artifacts = manifest['artifacts']
            if not artifacts or len(artifacts) > 32:
                raise ValueError('Unexpected artifact count')
            docs = {}
            for name, attrs in artifacts.items():
                if not safe_packet_name(name):
                    self.report.fail(f'Unsafe packet filename: {name}')
                    continue
                content = self.get(prefix + name)
                if content is None:
                    continue
                actual = sha256(content).hexdigest()
                expected = attrs.get('sha256', '')
                if not re.fullmatch(r'[0-9a-f]{64}', expected):
                    self.report.fail(f'Invalid manifest SHA-256 for {name}')
                elif actual != expected:
                    self.report.fail(f'Artifact SHA-256 mismatch: {name}, expected {expected}, observed {actual}')
                else:
                    self.report.checked_artifacts[name] = actual
                docs[name] = content
            if len(docs) == len(artifacts):
                self.verify_cases(manifest, docs)
            else:
                self.report.fail('Not all evidence packet files were retrievable')
            self.report.checks['manifest_engine_version'] = manifest.get('engine_version')
            self.report.checks['artifacts_verified'] = len(self.report.checked_artifacts)
            self.report.checks['cases_declared'] = len(manifest.get('cases', []))
            self.report.checks['manifest_digest'] = sha256(raw).hexdigest()
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            self.report.fail(f'Invalid evidence manifest: {exc}')

    def execute(self) -> Report:
        self.crawl()
        self.linked_assets()
        self.sitemap()
        self.robots()
        self.evidence()
        self.report.status = 'fail' if self.report.failures else 'pass-with-warnings' if self.report.warnings else 'pass'
        return self.report


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--base', default=DEFAULT_BASE, help='Owner-controlled deployment origin')
    ap.add_argument('--out', type=Path, default=Path('outputs/public-site-audit.json'))
    ap.add_argument('--max-pages', type=int, default=200)
    ap.add_argument('--max-files', type=int, default=500, help='Bound same-origin linked file HEAD probes')
    ap.add_argument('--strict-seo', action='store_true', help='Treat missing metadata, schema and sitemap entries as failures')
    ap.add_argument('--catalog', type=Path, default=None, help='Path to course-catalog.json')
    args = ap.parse_args(argv)
    if args.max_pages < 5 or args.max_pages > 1000:
        ap.error('max-pages must be 5..1000')
    if args.max_files < 1 or args.max_files > 5000:
        ap.error('max-files must be 1..5000')
    result = SiteAudit(args.base, strict_seo=args.strict_seo, max_pages=args.max_pages, max_files=args.max_files, catalog_path=args.catalog).execute()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(asdict(result), indent=2, sort_keys=True) + '\n', encoding='utf8')
    print(f'{result.status}: {len(result.checked_pages)} HTML pages, {len(result.lesson_pages)} lessons, '
          f'{len(result.checked_linked_files)} linked files, {len(result.checked_artifacts)} SHA-256 artifacts, {len(result.failures)} failures, '
          f'{len(result.warnings)} warnings; report={args.out}')
    for message in result.failures:
        print('FAIL:', message, file=sys.stderr)
    return 1 if result.failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
