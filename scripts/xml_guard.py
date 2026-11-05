"""Parse evidence XML while refusing all document type and entity declarations."""

from __future__ import annotations

# Every call uses the rejecting TreeBuilder below, including UTF-16 input.
# Tests prove harmless DTDs and internal/external entity declarations are rejected.
# nosemgrep: python.lang.security.use-defused-xml.use-defused-xml
import xml.etree.ElementTree as ET

XMLParseError = ET.ParseError


class RejectDocumentTypes(ET.TreeBuilder):
    """Stop at the parser's DTD callback before any entity can be expanded."""

    def doctype(self, _name: str, _public: str | None, _system: str | None) -> None:
        """Reject DTD syntax independently of its original byte encoding."""
        raise ET.ParseError("Evidence XML must not contain DTD or entity declarations")


def parse_xml(data: bytes) -> ET.Element:
    """Preserve ordinary XML trees while rejecting entity-bearing documents."""
    # Both operations use our DTD-rejecting target; the parser cannot expand entities.
    parser = ET.XMLParser(target=RejectDocumentTypes())  # noqa: S314 -- rejecting DTD target
    return ET.fromstring(data, parser=parser)  # noqa: S314 -- same guarded parser
