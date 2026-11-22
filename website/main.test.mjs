import assert from "node:assert/strict";
import test from "node:test";
import { detect, parseRelease } from "./main.mjs";

test("recommends only explicitly supported architectures", () => {
  for (const [platform, architecture, bitness, expected] of [
    ["Windows", "x86", "64", "windows"], ["Windows", "arm", "64", null],
    ["Linux", "x86", "64", "appimage"], ["Linux", "x86", "32", null],
    ["macOS", "arm", "64", "macos"], ["macOS", "x86", "64", null],
    ["Android", "x86", "64", null], ["macOS", "", "64", null],
  ]) assert.equal(detect({ platform, architecture, bitness }), expected);
  assert.equal(detect({ platform: "Windows", architecture: "x86", bitness: "64", wow64: true }), null);
});

test("only links uploaded assets in the expected release repository and tag", () => {
  const name = "gamevault-joiner-windows-x64-setup.exe";
  const url = `https://github.com/doopydoop364/gamevault-joiner/releases/download/v1.0.0/${name}`;
  const meta = { tag_name: "v1.0.0", draft: false, prerelease: false, assets: [
    { name, state: "uploaded", browser_download_url: url },
    { name: "gamevault-joiner-linux-x64.deb", state: "uploaded", browser_download_url: "https://example.com/gamevault.deb" },
  ] };
  assert.deepEqual(parseRelease(meta).files, { windows: url });
  assert.equal(parseRelease({ ...meta, prerelease: true }), null);
  assert.deepEqual(parseRelease({ ...meta, assets: [meta.assets[0], meta.assets[0]] }).files, {});
});
