"""Exercise hostile audit responses through urllib without opening a socket."""

from contextlib import contextmanager
from email.message import Message
from fractions import Fraction
from io import BytesIO
import unittest
from unittest.mock import patch
from urllib import request
from urllib.error import URLError
from urllib.response import addinfourl

from scripts import audit_public_site as auditor


BASE = 'https://example.invalid/'


@contextmanager
def transport(respond):
    """Keep the real opener/redirect processing; replace only network I/O."""
    calls = []

    def open_response(handler, req):
        calls.append((req.get_method(), req.full_url))
        status, location, body = respond(req)
        headers = Message()
        if location is not None:
            headers['Location'] = location
        response = addinfourl(body, headers, req.full_url, status)
        response.msg = 'Simulated HTTP response'
        return response

    with (
        patch.object(request, '_opener', None),
        patch.object(request.HTTPHandler, 'http_open', open_response),
        patch.object(request.HTTPSHandler, 'https_open', open_response),
    ):
        yield calls


class AuditRedirectSecurityTests(unittest.TestCase):
    def test_fetch_blocks_off_origin_redirect_before_any_second_request(self):
        destination = 'http://127.0.0.1:9/private'

        def respond(req):
            if req.full_url == BASE:
                return 302, destination, BytesIO(b'')
            return 200, None, BytesIO(b'private response')

        with transport(respond) as calls:
            audit = auditor.SiteAudit(BASE)
            self.assertIsNone(audit.get(BASE))
        self.assertEqual(calls, [('GET', BASE)])
        self.assertTrue(any('redirect' in failure.lower() for failure in audit.report.failures))

    def test_probe_blocks_off_origin_redirect_before_any_second_request(self):
        def respond(req):
            if req.full_url == BASE:
                return 307, 'https://other.invalid/asset', BytesIO(b'')
            return 200, None, BytesIO(b'')

        with transport(respond) as calls:
            with self.assertRaises((ValueError, URLError)):
                auditor.default_probe(BASE)
        self.assertEqual(calls, [('HEAD', BASE)])

    def test_probe_fallback_get_blocks_off_origin_redirect(self):
        def respond(req):
            if req.get_method() == 'HEAD':
                return 405, None, BytesIO(b'')
            if req.full_url == BASE:
                return 303, 'http://169.254.169.254/simulated', BytesIO(b'')
            return 200, None, BytesIO(b'')

        with transport(respond) as calls:
            with self.assertRaises((ValueError, URLError)):
                auditor.default_probe(BASE)
        self.assertEqual(calls, [('HEAD', BASE), ('GET', BASE)])

    def test_fetch_allows_same_origin_relative_redirect(self):
        def respond(req):
            if req.full_url == BASE:
                return 301, '/canonical/', BytesIO(b'')
            return 200, None, BytesIO(b'allowed response')

        with transport(respond) as calls:
            status, final, content, _ = auditor.default_fetch(BASE)
        self.assertEqual((status, final, content), (200, BASE + 'canonical/', b'allowed response'))
        self.assertEqual(calls, [('GET', BASE), ('GET', BASE + 'canonical/')])

    def test_probe_preserves_head_across_same_origin_redirect(self):
        def respond(req):
            if req.full_url == BASE:
                return 308, '/canonical/', BytesIO(b'')
            return 200, None, BytesIO(b'')

        with transport(respond) as calls:
            self.assertEqual(auditor.default_probe(BASE), (200, BASE + 'canonical/'))
        self.assertEqual(calls, [('HEAD', BASE), ('HEAD', BASE + 'canonical/')])

    def test_redirect_response_body_is_not_read_outside_fetch_size_limit(self):
        class RedirectBody(BytesIO):
            def read(self, *args):
                raise AssertionError('Redirect body must be closed without reading it')

        def respond(req):
            if req.full_url == BASE:
                return 302, '/canonical/', RedirectBody(b'')
            return 200, None, BytesIO(b'allowed response')

        with transport(respond):
            self.assertEqual(auditor.default_fetch(BASE)[2], b'allowed response')

    def test_redirect_loop_is_bounded(self):
        def respond(req):
            return 302, '/again/', BytesIO(b'')

        with transport(respond) as calls:
            with self.assertRaises((ValueError, URLError)):
                auditor.default_fetch(BASE)
        self.assertLessEqual(len(calls), 11)


class AuditNumericSecurityTests(unittest.TestCase):
    def test_external_numbers_reject_excessive_exponents(self):
        for value in ('1e10000', '1e-10000', '0e999999999'):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    auditor.rational(value)

    def test_external_numbers_reject_excessive_significands(self):
        with self.assertRaises(ValueError):
            auditor.rational('1.' + '1' * 1024)

    def test_retained_high_precision_evidence_remains_exact(self):
        value = '0.' + '0' * 99 + '1'
        self.assertEqual(auditor.rational(value), Fraction(1, 10 ** 100))
        self.assertEqual(auditor.rational('2.4e25'), 24 * 10 ** 24)


if __name__ == '__main__':
    unittest.main()
