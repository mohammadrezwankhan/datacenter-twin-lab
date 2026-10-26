"""Pure-standard-library regression tests for the read-only public-site auditor."""
from __future__ import annotations

import importlib.util
import json
from hashlib import sha256
from pathlib import Path
import unittest
from datacenter_twin import __version__
from urllib.error import HTTPError

SOURCE = Path(__file__).resolve().parents[1] / 'scripts' / 'audit_public_site.py'
spec = importlib.util.spec_from_file_location('auditor', SOURCE)
auditor = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = auditor
spec.loader.exec_module(auditor)
BASE = 'https://example.invalid/'


def page(path, schema='TechArticle', links=''):
    title = 'Datacenter Twin Lab'
    schema_json = json.dumps({'@context': 'https://schema.org', '@type': schema})
    return f'''<!doctype html><html lang="en"><head><title>{title}</title>
<link rel="canonical" href="{BASE[:-1]}{path}" />
<meta name="description" content="Synthetic exercises" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="Synthetic exercises" />
<meta property="og:image" content="{BASE}cover.png" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">{schema_json}</script>
</head><body><h1>Datacenter Twin Lab</h1>{links}</body></html>'''.encode()


def fixtures(*, corrupt=False):
    receipt = b'This is a synthetic verification fixture.\n'
    manifest = {
        'engine_version': __version__,
        'artifacts': {'receipt.md': {'sha256': sha256(receipt).hexdigest()}},
        'cases': [],
    }
    learn = ''.join(f'<a href="/learn/{i:02d}/">Lesson {i}</a>' for i in range(1, 25))
    items = {
        '/': page('/', 'SoftwareApplication', '<a href="/learn/">Lessons</a>'),
        '/learn/': page('/learn/', 'Course', learn),
        '/about/': page('/about/'),
        '/evidence/': page('/evidence/'),
        '/studies/emt/': page('/studies/emt/'),
        f'/data/evidence/v{__version__}/manifest.json': json.dumps(manifest).encode(),
        f'/data/evidence/v{__version__}/receipt.md': b'TAMPERED' if corrupt else receipt,
    }
    for i in range(1, 25):
        items[f'/learn/{i:02d}/'] = page(f'/learn/{i:02d}/', ['LearningResource', 'TechArticle'])
    urls = ''.join(f'<url><loc>{BASE[:-1]}{path}</loc><lastmod>2026-10-12</lastmod></url>' for path in items if path.endswith('/'))
    items['/sitemap.xml'] = f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'.encode()
    items['/robots.txt'] = ('User-agent: *\nAllow: /\n' + ''.join(f'User-agent: {bot}\nAllow: /\n' for bot in auditor.BOTS) + f'Sitemap: {BASE}sitemap.xml\n').encode()
    return items


def fetch_for(items):
    def get(url):
        path = url.removeprefix(BASE[:-1])
        if path not in items:
            raise HTTPError(url, 404, 'missing', {}, None)
        return 200, url, items[path], 'application/octet-stream'
    return get


class AuditorTests(unittest.TestCase):
    def test_strict_site_clean_fixture_passes(self):
        audit = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(fixtures()))
        report = audit.execute()
        self.assertEqual(report.status, 'pass', report.failures)
        self.assertEqual(report.checks['lessons_discovered'], 24)
        self.assertEqual(report.checks['artifacts_verified'], 1)
        self.assertEqual(len(report.sitemap_pages), 29)

    def test_current_packet_is_audited_even_when_clean_historical_packet_exists(self):
        items = fixtures(corrupt=True)
        historical = b'Historical receipt.\n'
        items['/data/evidence/v2.0.0/receipt.md'] = historical
        items['/data/evidence/v2.0.0/manifest.json'] = json.dumps({
            'engine_version': '2.0.0',
            'artifacts': {'receipt.md': {'sha256': sha256(historical).hexdigest()}},
            'cases': [],
        }).encode()
        report = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items)).execute()
        self.assertEqual(report.status, 'fail')
        self.assertTrue(any('SHA-256 mismatch' in x for x in report.failures), report.failures)

    def test_raw_byte_hash_mismatch_is_failure(self):
        audit = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(fixtures(corrupt=True)))
        result = audit.execute()
        self.assertEqual(result.status, 'fail')
        self.assertTrue(any('SHA-256 mismatch' in x for x in result.failures))

    def test_missing_structured_data_fails_strict_only(self):
        items = fixtures()
        items['/'] = items['/'].replace(b'SoftwareApplication', b'WebPage')
        self.assertTrue(any('SoftwareApplication' in x for x in auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items)).execute().failures))
        non_strict = auditor.SiteAudit(BASE, strict_seo=False, fetch=fetch_for(items)).execute()
        self.assertEqual(non_strict.status, 'pass-with-warnings')

    def test_missing_tech_article_fails_strict_seo(self):
        items = fixtures()
        items['/learn/01/'] = page('/learn/01/', ['LearningResource'])
        report = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items)).execute()
        self.assertTrue(any('Expected lesson TechArticle' in x for x in report.failures))

    def test_malformed_packet_name_rejected(self):
        self.assertFalse(auditor.safe_packet_name('../secrets'))
        self.assertFalse(auditor.safe_packet_name('manifest/next'))
        self.assertTrue(auditor.safe_packet_name('run-canonical-sha.json'))

    def test_linked_download_is_probed_without_reading_entire_payload(self):
        items = fixtures()
        items['/'] = page('/', 'SoftwareApplication',
                          '<a href="/data/evidence/v2.0.0/receipt.md">Download report</a>')
        calls = []
        def probe(url):
            calls.append(url)
            return 200, url
        result = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items), probe=probe).execute()
        self.assertEqual(result.status, 'pass', result.failures)
        self.assertEqual(len(result.checked_linked_files), 1)
        self.assertEqual(calls, [BASE + 'data/evidence/v2.0.0/receipt.md'])

    def test_evidence_html_reports_are_probed_as_linked_files_not_crawled_as_pages(self):
        items = fixtures()
        report_url = '/data/evidence/v2.0.0/report-canonical-1mw-100kwh.html'
        items['/evidence/'] = page('/evidence/', links=f'<a href="{report_url}">Raw report</a>')
        items[report_url] = b'<!doctype html><html><head><title>Raw</title></head><body>Raw</body></html>'
        calls = []
        def probe(url):
            calls.append(url)
            return 200, url
        result = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items), probe=probe).execute()
        self.assertEqual(result.status, 'pass', result.failures)
        self.assertIn(BASE + report_url.lstrip('/'), result.checked_linked_files)
        self.assertNotIn(BASE + report_url.lstrip('/'), result.checked_pages)

    def test_broken_linked_download_is_a_release_failure(self):
        items = fixtures()
        items['/'] = page('/', 'SoftwareApplication', '<a href="/missing.md">Broken</a>')
        def missing(url):
            raise HTTPError(url, 404, 'not found', {}, None)
        report = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items), probe=missing).execute()
        self.assertTrue(any('Broken same-site linked file' in x for x in report.failures))

    def test_misdirected_lesson_canonical_fails_strict_seo(self):
        items = fixtures()
        items['/learn/01/'] = items['/learn/01/'].replace(
            (BASE + 'learn/01/').encode(), BASE.encode())
        report = auditor.SiteAudit(BASE, strict_seo=True, fetch=fetch_for(items)).execute()
        self.assertTrue(any('Lesson canonical does not identify itself' in x for x in report.failures))

    def test_independent_ledger_detects_partition_error(self):
        energy = dict(requested_it_kwh='1', served_it_kwh='1', unserved_it_kwh='0',
                      grid_kwh='1', generator_kwh='0', battery_stored_change_kwh='0',
                      distribution_loss_kwh='0', battery_charge_loss_kwh='0',
                      battery_discharge_loss_kwh='0')
        run = {'intervals': [{'battery_start_kwh': '20', 'battery_end_kwh': '20', 'energy': energy}],
               'summary': {'requested_it_kwh': '1', 'served_it_kwh': '1', 'unserved_it_kwh': '0'}}
        self.assertEqual(auditor.SiteAudit.verify_ledger(run), [])
        run['intervals'][0]['energy']['unserved_it_kwh'] = '0.5'
        self.assertTrue(auditor.SiteAudit.verify_ledger(run))


if __name__ == '__main__':
    unittest.main()
