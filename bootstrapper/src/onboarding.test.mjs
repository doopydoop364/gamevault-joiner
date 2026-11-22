import assert from "node:assert/strict";
import test from "node:test";
import { canAdvance, matchesPath, settings } from "./onboarding.mjs";

test("wizard gates unsupported platforms, unconfirmed installs and pending accounts", () => {
  assert.equal(canAdvance(1, { supported: false }), false);
  assert.equal(canAdvance(1, { supported: true }), true);
  assert.equal(canAdvance(2, { clientOpen: false }), false);
  assert.equal(canAdvance(3, { prepared: false }), false);
  assert.equal(canAdvance(4, { profileReady: false }), false);
});

test("completion requires both observed paths and all requested settings", () => {
  assert.equal(matchesPath("C:\\Users\\me\\Games", "c:/Users/me/Games/", true), true);
  assert.equal(matchesPath("/home/me/Games", "/home/me/games", false), false);
  assert.equal(matchesPath("/home/me/Games", "", false), false);
  assert.equal(matchesPath("/home/me/Games", "/home/me/Games/../Games", false), false);
  assert.equal(canAdvance(5, { pathsMatch: true, enabledCount: settings.length - 1 }), false);
  assert.equal(canAdvance(5, { pathsMatch: false, enabledCount: settings.length }), false);
  assert.equal(canAdvance(5, { pathsMatch: true, enabledCount: settings.length }), true);
});
