from html.parser import HTMLParser
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

import package_release as release


class SiteHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.anchors = set()
        self.formats = set()

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                raise AssertionError(f'Duplicate ID {attrs["id"]}')
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.anchors.add(attrs["href"][1:])
        if "data-format" in attrs:
            self.formats.add(attrs["data-format"])


class ProjectTests(unittest.TestCase):
    def test_download_links_match_release_packaging(self):
        root = release.ROOT
        parser = SiteHTML()
        parser.feed((root / "website/index.html").read_text())
        self.assertFalse(parser.anchors - parser.ids)
        script = (root / "website/main.mjs").read_text()
        formats = dict(re.findall(r'^  (\w+): "(gamevault-joiner-[^"]+)",$', script, re.M))
        self.assertEqual(parser.formats, formats.keys())
        self.assertEqual(set(formats.values()),
                         {name for platform in release.PLATFORMS.values() for name in platform.values()})

    def test_rejects_incomplete_release_and_version_mismatch(self):
        tag = 'v' + json.loads((release.ROOT / "bootstrapper/package.json").read_text())["version"]
        with tempfile.TemporaryDirectory() as directory, patch.object(release, 'OUTPUT', Path(directory)):
            with self.assertRaises(SystemExit):
                release.verify_release(tag)
            for platform in release.PLATFORMS.values():
                for name in platform.values():
                    (release.OUTPUT / name).write_bytes(b'artifact fixture')
            release.verify_release(tag)
            for bad in ('v99.99.99', 'v0.1.0-beta', 'v00.1.0'):
                with self.assertRaises(SystemExit):
                    release.verify_release(bad)

    def test_public_sources_use_only_the_canonical_server(self):
        identifier = 'https://gamevault.pcenthusiast.blog'
        for location in ('bootstrapper/src/onboarding.mjs', 'website/index.html'):
            text = (release.ROOT / location).read_text()
            self.assertIn(identifier, text)
            self.assertNotRegex(text, r'https?://(?:\d{1,3}\.){3}\d{1,3}')


if __name__ == "__main__":
    unittest.main()
