"""Exercise the XML parser used by source/site evidence tooling."""

from __future__ import annotations

import unittest

from scripts.xml_guard import XMLParseError, parse_xml


class XmlGuardTests(unittest.TestCase):
    """Reject declarations across encodings while retaining valid XML data."""

    def test_valid_namespaces_and_text_survive_supported_encodings(self) -> None:
        """Preserve the parsed tree and numeric/text data used by callers."""
        for encoding in ("utf-8", "utf-16", "utf-16-le", "utf-16-be"):
            with self.subTest(encoding=encoding):
                tree = parse_xml(
                    '<root xmlns="urn:test"><value>3 &amp; 4</value></root>'.encode(encoding)
                )
                self.assertEqual(tree.tag, "{urn:test}root")
                self.assertEqual(tree[0].text, "3 & 4")

    def test_dtd_entities_and_malformed_xml_fail_before_expansion(self) -> None:
        """Reject internal entities, external references and harmless DTDs too."""
        cases = (
            '<!DOCTYPE root [<!ENTITY x "expanded">]><root>&x;</root>',
            '<!DOCTYPE root SYSTEM "file:///must-not-open"><root/>',
            '<!DOCTYPE root [<!ENTITY x SYSTEM "https://example.invalid/entity">]><root>&x;</root>',
            "<!DOCTYPE root><root/>",
            "<root>&undeclared;</root>",
            "<root>",
        )
        for text in cases:
            for encoding in ("utf-8", "utf-16", "utf-16-le", "utf-16-be"):
                with self.subTest(text=text, encoding=encoding), self.assertRaises(XMLParseError):
                    parse_xml(text.encode(encoding))


if __name__ == "__main__":
    unittest.main()
