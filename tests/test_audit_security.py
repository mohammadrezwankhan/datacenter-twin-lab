"""Exercise hostile audit responses through urllib without opening a socket."""

from __future__ import annotations

import unittest
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from email.message import Message
from fractions import Fraction
from io import BytesIO
from typing import SupportsIndex, TypeAliasType, override
from unittest.mock import patch
from urllib import request
from urllib.error import URLError
from urllib.response import addinfourl

from scripts import audit_public_site as auditor

BASE = "https://example.invalid/"
# OpenGrep 1.33 cannot parse PEP 695 statements; retain the concrete transport alias.
TransportReply = TypeAliasType("TransportReply", tuple[int, str | None, BytesIO])  # noqa: UP040


class SimulatedResponse(addinfourl):
    msg = "Simulated HTTP response"


@contextmanager
def transport(
    respond: Callable[[request.Request], TransportReply],
) -> Iterator[list[tuple[str, str]]]:
    """Keep the real opener/redirect processing; replace only network I/O."""
    calls: list[tuple[str, str]] = []

    def open_response(
        _handler: request.AbstractHTTPHandler, req: request.Request
    ) -> SimulatedResponse:
        calls.append((req.get_method(), req.full_url))
        status, location, body = respond(req)
        headers = Message()
        if location is not None:
            headers["Location"] = location
        return SimulatedResponse(body, headers, req.full_url, status)

    with (
        patch.object(request, "_opener", None),
        patch.object(request.HTTPHandler, "http_open", open_response),
        patch.object(request.HTTPSHandler, "https_open", open_response),
    ):
        yield calls


class AuditRedirectSecurityTests(unittest.TestCase):
    def test_request_policy_blocks_unsupported_urls_before_transport(self) -> None:
        urls = (
            "file:///simulated-private-file",
            "ftp://example.invalid/asset",
            "https:///missing-host",
            "https://user@example.invalid/",
        )
        with patch.object(auditor, "build_opener", side_effect=AssertionError("No transport")):
            for operation in (auditor.default_fetch, auditor.default_probe):
                for url in urls:
                    with (
                        self.subTest(operation=operation.__name__, url=url),
                        self.assertRaisesRegex(ValueError, "HTTP\\(S\\) without credentials"),
                    ):
                        operation(url)

    def test_existing_http_policy_and_read_only_method_are_preserved(self) -> None:
        url = "http://example.invalid/"

        def respond(req: request.Request) -> TransportReply:
            self.assertEqual(req.get_method(), "GET")
            return 200, None, BytesIO(b"synthetic response")

        with transport(respond) as calls:
            self.assertEqual(auditor.default_fetch(url)[:3], (200, url, b"synthetic response"))
        self.assertEqual(calls, [("GET", url)])

    def test_unknown_transport_response_and_missing_status_fail_closed(self) -> None:
        cases = (
            (object(), "HTTP response"),
            (SimulatedResponse(BytesIO(b""), Message(), BASE), "HTTP status"),
        )
        for response, message in cases:
            with self.subTest(message=message), patch.object(auditor, "build_opener") as opener:
                opener.return_value.open.return_value = response
                with self.assertRaisesRegex(ValueError, message):
                    auditor.default_probe(BASE)

    def test_fetch_byte_limit_remains_enforced(self) -> None:
        def respond(_req: request.Request) -> TransportReply:
            return 200, None, BytesIO(b"123456789")

        with (
            transport(respond),
            patch.object(auditor, "MAX_BYTES", 8),
            self.assertRaisesRegex(ValueError, "exceeds 8 byte audit limit"),
        ):
            auditor.default_fetch(BASE)

    def test_fetch_blocks_off_origin_redirect_before_any_second_request(self) -> None:
        destination = "http://127.0.0.1:9/private"

        def respond(req: request.Request) -> TransportReply:
            if req.full_url == BASE:
                return 302, destination, BytesIO(b"")
            return 200, None, BytesIO(b"private response")

        with transport(respond) as calls:
            audit = auditor.SiteAudit(BASE)
            self.assertIsNone(audit.get(BASE))
        self.assertEqual(calls, [("GET", BASE)])
        self.assertTrue(any("redirect" in failure.lower() for failure in audit.report.failures))

    def test_probe_blocks_off_origin_redirect_before_any_second_request(self) -> None:
        def respond(req: request.Request) -> TransportReply:
            if req.full_url == BASE:
                return 307, "https://other.invalid/asset", BytesIO(b"")
            return 200, None, BytesIO(b"")

        with transport(respond) as calls, self.assertRaises((ValueError, URLError)):
            auditor.default_probe(BASE)
        self.assertEqual(calls, [("HEAD", BASE)])

    def test_probe_fallback_get_blocks_off_origin_redirect(self) -> None:
        def respond(req: request.Request) -> TransportReply:
            if req.get_method() == "HEAD":
                return 405, None, BytesIO(b"")
            if req.full_url == BASE:
                return 303, "http://169.254.169.254/simulated", BytesIO(b"")
            return 200, None, BytesIO(b"")

        with transport(respond) as calls, self.assertRaises((ValueError, URLError)):
            auditor.default_probe(BASE)
        self.assertEqual(calls, [("HEAD", BASE), ("GET", BASE)])

    def test_fetch_allows_same_origin_relative_redirect(self) -> None:
        def respond(req: request.Request) -> TransportReply:
            if req.full_url == BASE:
                return 301, "/canonical/", BytesIO(b"")
            return 200, None, BytesIO(b"allowed response")

        with transport(respond) as calls:
            status, final, content, _ = auditor.default_fetch(BASE)
        self.assertEqual((status, final, content), (200, BASE + "canonical/", b"allowed response"))
        self.assertEqual(calls, [("GET", BASE), ("GET", BASE + "canonical/")])

    def test_probe_preserves_head_across_same_origin_redirect(self) -> None:
        def respond(req: request.Request) -> TransportReply:
            if req.full_url == BASE:
                return 308, "/canonical/", BytesIO(b"")
            return 200, None, BytesIO(b"")

        with transport(respond) as calls:
            self.assertEqual(auditor.default_probe(BASE), (200, BASE + "canonical/"))
        self.assertEqual(calls, [("HEAD", BASE), ("HEAD", BASE + "canonical/")])

    def test_redirect_response_body_is_not_read_outside_fetch_size_limit(self) -> None:
        class RedirectBody(BytesIO):
            @override
            def read(self, _size: SupportsIndex | None = -1, /) -> bytes:
                raise AssertionError("Redirect body must be closed without reading it")

        def respond(req: request.Request) -> TransportReply:
            if req.full_url == BASE:
                return 302, "/canonical/", RedirectBody(b"")
            return 200, None, BytesIO(b"allowed response")

        with transport(respond):
            self.assertEqual(auditor.default_fetch(BASE)[2], b"allowed response")

    def test_redirect_loop_is_bounded(self) -> None:
        def respond(_req: request.Request) -> TransportReply:
            return 302, "/again/", BytesIO(b"")

        with transport(respond) as calls, self.assertRaises((ValueError, URLError)):
            auditor.default_fetch(BASE)
        self.assertLessEqual(len(calls), 11)


class AuditNumericSecurityTests(unittest.TestCase):
    def test_external_numbers_reject_excessive_exponents(self) -> None:
        for value in ("1e10000", "1e-10000", "0e999999999"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                auditor.rational(value)

    def test_external_numbers_reject_excessive_significands(self) -> None:
        with self.assertRaises(ValueError):
            auditor.rational("1." + "1" * 1024)

    def test_retained_high_precision_evidence_remains_exact(self) -> None:
        value = "0." + "0" * 99 + "1"
        self.assertEqual(auditor.rational(value), Fraction(1, 10**100))
        self.assertEqual(auditor.rational("2.4e25"), 24 * 10**24)


if __name__ == "__main__":
    unittest.main()
