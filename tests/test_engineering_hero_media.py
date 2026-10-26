from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import prepare_browser_demo


class EngineeringHeroMediaTests(unittest.TestCase):
    def test_demo_mode_file_enables_hero_when_process_override_is_absent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            mode_file = root / 'apps/web/.env.demo'
            mode_file.parent.mkdir(parents=True)
            mode_file.write_text('VITE_ENGINEERING_HERO=1\n')

            with patch.object(prepare_browser_demo, 'ROOT', root), patch.dict(
                os.environ, {}, clear=True
            ):
                self.assertTrue(prepare_browser_demo.engineering_hero_enabled())

    def test_browser_preparation_does_not_stage_hero_media_when_flag_is_disabled(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            self._make_minimal_demo_tree(root)

            with patch.object(prepare_browser_demo, 'ROOT', root), patch.dict(
                os.environ, {'VITE_ENGINEERING_HERO': '0'}
            ):
                prepare_browser_demo.prepare()

            staged = root / '.local/engineering-hero-public/assets/engineering-hero/v1'
            self.assertFalse(staged.exists())

    def test_browser_preparation_copies_only_hash_verified_hero_files_when_enabled(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            self._make_minimal_demo_tree(root)
            release = root / 'assets/engineering-hero/v1'
            self._make_hero_release_tree(release)

            with patch.object(prepare_browser_demo, 'ROOT', root), patch.dict(
                os.environ, {'VITE_ENGINEERING_HERO': '1'}
            ):
                prepare_browser_demo.prepare()

            staged = root / '.local/engineering-hero-public/assets/engineering-hero/v1'
            self.assertEqual((staged / 'release-media.json').is_file(), True)
            self.assertEqual((staged / 'poster.png').read_bytes(), b'poster')
            self.assertEqual((staged / 'integration/vanilla/khan-grid-hero.js').read_bytes(), b'custom element')
            self.assertEqual((staged / 'integration/vanilla/embed.css').read_bytes(), b'embed styles')
            self.assertEqual((staged / 'src/config.js').read_bytes(), b'site configuration')
            self.assertFalse((staged / 'unlisted.txt').exists())

    def test_browser_preparation_rejects_a_manifest_missing_adapter_dependencies(self):
        for omitted in ('integration/vanilla/embed.css', 'src/config.js'):
            with self.subTest(omitted=omitted), tempfile.TemporaryDirectory() as directory:
                # Match production ROOT even when Windows TEMP uses an 8.3 alias.
                root = Path(directory).resolve()
                release = root / 'assets/engineering-hero/v1'
                self._make_hero_release_tree(release, omit_from_manifest=omitted)

                with self.assertRaisesRegex(SystemExit, f'required files: .*{omitted}'):
                    prepare_browser_demo.copy_verified_engineering_hero_media(
                        release,
                        root / '.local/engineering-hero-public',
                    )

    def test_browser_preparation_rejects_runtime_version_that_differs_from_web_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            self._make_minimal_demo_tree(root)
            runtime_package = root / 'apps/web/node_modules/pyodide/package.json'
            runtime_package.write_text(json.dumps({'version': '314.0.6'}))
            with patch.object(prepare_browser_demo, 'ROOT', root), self.assertRaisesRegex(
                SystemExit, 'Expected locked Pyodide 314.0.7'
            ):
                prepare_browser_demo.prepare()

    def _make_minimal_demo_tree(self, root: Path) -> None:
        web = root / 'apps/web'
        web.mkdir(parents=True)
        (web / 'package.json').write_text(json.dumps({'devDependencies': {'pyodide': '314.0.7'}}))
        runtime = web / 'node_modules/pyodide'
        runtime.mkdir(parents=True)
        (runtime / 'package.json').write_text(json.dumps({'version': '314.0.7'}))
        for name in prepare_browser_demo.RUNTIME_FILES:
            (runtime / name).write_bytes(name.encode())

        for name in prepare_browser_demo.MODULES:
            (root / f'datacenter_twin/{name}.py').parent.mkdir(parents=True, exist_ok=True)
            (root / f'datacenter_twin/{name}.py').write_text('# fixture')
        (root / 'datacenter_twin/resources').mkdir(parents=True, exist_ok=True)
        for name in ('LICENSE', 'NOTICE'):
            (root / name).write_text(name)

        public = root / 'apps/web/public'
        public.mkdir(parents=True)
        for name in (
            'THIRD-PARTY-NOTICES.txt', 'favicon.png', 'favicon.ico', 'apple-touch-icon.png',
            'apple-touch-icon-precomposed.png', '_headers', '_redirects',
        ):
            (public / name).write_bytes(name.encode())
        (root / 'docs/third-party').mkdir(parents=True)

        version = prepare_browser_demo.__version__
        evidence = root / f'data/evidence/v{version}'
        evidence.mkdir(parents=True)
        (evidence / 'manifest.json').write_text(json.dumps({
            'engine_version': version, 'artifacts': {},
        }))
        (root / f'data/evidence/index-v{version}.json').write_text('{}')

    def _make_hero_release_tree(self, release: Path, omit_from_manifest: str | None = None) -> None:
        content = {
            'hero-1080p60.mp4': b'video',
            'poster.png': b'poster',
            'integration/vanilla/khan-grid-hero.js': b'custom element',
            'integration/vanilla/embed.css': b'embed styles',
            'integration/vanilla/host.css': b'host styles',
            'src/config.js': b'site configuration',
            'index.html': b'frame',
            'csp.json': json.dumps({
                'importMapHash': 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                'suggestedContentSecurityPolicy': "default-src 'self'; script-src 'self'",
            }).encode(),
            'unlisted.txt': b'not in the verified manifest',
        }
        entries = []
        for name, data in content.items():
            path = release / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            if name != 'unlisted.txt' and name != omit_from_manifest:
                entries.append({'path': name, 'bytes': len(data), 'sha256': sha256(data).hexdigest()})
        (release / 'release-media.json').write_text(json.dumps({
            'status': 'verified',
            'frames': 900,
            'width': 1920,
            'height': 1080,
            'fps': 60,
            'duration': 15,
            'site': 'mrkhan',
            'files': entries,
        }))


if __name__ == '__main__':
    unittest.main()
