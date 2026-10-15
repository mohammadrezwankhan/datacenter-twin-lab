"""Keep previously published, versioned evidence URLs usable after releases."""
from hashlib import sha256
import json
from pathlib import Path
import tempfile
import unittest

from scripts.prepare_browser_demo import copy_evidence_packets


class PublicEvidenceHistoryTests(unittest.TestCase):
    def test_old_and_current_packets_retain_manifest_verified_bytes(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            copy_evidence_packets(root / 'data/evidence', output)
            for version in ('v1.0.0', 'v2.0.0'):
                original = root / 'data/evidence' / version
                target = output / version
                manifest = json.loads((original / 'manifest.json').read_text())
                self.assertEqual((target / 'manifest.json').read_bytes(),
                                 (original / 'manifest.json').read_bytes())
                for name, entry in manifest['artifacts'].items():
                    self.assertEqual(sha256((target / name).read_bytes()).hexdigest(),
                                     entry['sha256'], (version, name))

    def test_corrupt_or_escaping_artifact_is_rejected(self):
        for name in ('proof.json', '../private.json'):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                packet = root / 'source/v1.0.0'
                packet.mkdir(parents=True)
                (packet / 'manifest.json').write_text(json.dumps({
                    'artifacts': {name: {'sha256': '0' * 64}}}))
                (packet / name).write_text('unverified')
                with self.assertRaises(SystemExit):
                    copy_evidence_packets(root / 'source', root / 'output')
