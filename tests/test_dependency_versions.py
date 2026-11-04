"""Reject stale locks before downloads without weakening installed-version checks."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import check_dependency_versions as check


class DependencyVersionTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.root.joinpath('pyproject.toml').write_text(
            '[project.optional-dependencies]\napi = ["fastapi==0.162.0"]\n'
            'test-api = ["httpx==0.28.1"]\nstudies = ["numpy==2.5.4"]\n', encoding='utf-8')
        self.root.joinpath('requirements-api.lock').write_text('fastapi==0.162.0\nhttpx==0.28.1\n', encoding='utf-8')
        self.root.joinpath('requirements-studies.lock').write_text('numpy==2.5.4\n', encoding='utf-8')
        root_patch = patch.object(check, 'root', self.root)
        root_patch.start()
        self.addCleanup(root_patch.stop)

    def test_offline_check_needs_no_installed_packages(self):
        with patch.object(check.importlib.metadata, 'version', side_effect=AssertionError('must stay offline')):
            check.main(['--lock-only', 'api', 'test-api', 'studies'])

    def test_pr100_conflict_fails_before_install(self):
        self.root.joinpath('requirements-api.lock').write_text('fastapi==0.159.1\nhttpx==0.28.1\n', encoding='utf-8')
        with self.assertRaisesRegex(SystemExit, 'fastapi==0.162.0 is missing'):
            check.main(['--lock-only', 'api'])

    def test_studies_uses_its_own_lock(self):
        self.root.joinpath('requirements-studies.lock').write_text('numpy==2.4.6\n', encoding='utf-8')
        with self.assertRaisesRegex(SystemExit, 'requirements-studies.lock'):
            check.main(['--lock-only', 'studies'])

    def test_default_still_checks_installed_version(self):
        with patch.object(check.importlib.metadata, 'version', return_value='0.159.1'):
            with self.assertRaisesRegex(SystemExit, 'installed 0.159.1, declared 0.162.0'):
                check.main(['api'])

    def test_default_accepts_matching_install(self):
        with patch.object(check.importlib.metadata, 'version', return_value='0.162.0'):
            check.main(['api'])

    def test_empty_or_unknown_extra_fails(self):
        for args in ([], ['--lock-only', 'typo']):
            with self.subTest(args=args), self.assertRaises(SystemExit):
                check.main(args)
