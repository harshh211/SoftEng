// Run with: node --test tests/pwa.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PUBLIC = path.join(__dirname, "..", "public");
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.webmanifest"), "utf8"));

// Read width/height straight out of a PNG header.
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test("manifest has the fields Chrome needs to make Bento installable", () => {
  assert.strictEqual(manifest.name, "Bento");
  assert.ok(manifest.start_url);
  assert.strictEqual(manifest.display, "standalone");
  assert.ok(manifest.theme_color && manifest.background_color);
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192"), "needs a 192x192 icon");
  assert.ok(sizes.includes("512x512"), "needs a 512x512 icon");
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"), "needs a maskable icon");
});

test("every icon in the manifest exists and is really the size it claims", () => {
  for (const icon of manifest.icons) {
    const file = path.join(PUBLIC, icon.src);
    assert.ok(fs.existsSync(file), `${icon.src} is missing`);
    const [w, h] = icon.sizes.split("x").map(Number);
    const actual = pngSize(file);
    assert.deepStrictEqual(actual, { w, h }, `${icon.src} is ${actual.w}x${actual.h}`);
  }
});

// Load sw.js in a sandbox with fake service worker globals.
function loadSW() {
  const listeners = {};
  const cached = [];
  const self = {
    location: { origin: "https://bento.test" },
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting() {},
    clients: { claim() {} },
  };
  const caches = {
    open: async () => ({ addAll: async (urls) => cached.push(...urls), put: async () => {} }),
    keys: async () => [],
    match: async () => undefined,
    delete: async () => true,
  };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLIC, "sw.js"), "utf8"), {
    self, caches, URL, fetch: async () => ({}),
  });
  return { listeners, cached };
}

test("service worker precaches the app shell on install", async () => {
  const { listeners, cached } = loadSW();
  let pending;
  listeners.install({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.ok(cached.includes("/"));
  assert.ok(cached.includes("/manifest.webmanifest"));
});

test("service worker never touches Firebase/Firestore requests", () => {
  const { listeners } = loadSW();
  let handled = false;
  const event = {
    request: { method: "GET", url: "https://firestore.googleapis.com/v1/projects/x", mode: "cors" },
    respondWith: () => (handled = true),
  };
  listeners.fetch(event);
  assert.strictEqual(handled, false);
});
