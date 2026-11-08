import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import { connectDB, disconnectDB } from "../src/config/database.js";
import { encryptSecret, decryptSecret, maskSecret, isMasked } from "../src/utils/cryptoUtil.js";
import { StoreSettingsService } from "../src/services/StoreSettingsService.js";

test("cryptoUtil: encryption, decryption and masking suite", async (t) => {
  await t.test("encryptSecret and decryptSecret work symmetrically", () => {
    const original = "test_dummy_secret_key_99887766";
    const encrypted = encryptSecret(original);

    assert.notEqual(encrypted, original);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);

    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, original);
  });

  await t.test("maskSecret correctly masks sensitive tokens", () => {
    const secret = "test_secret_key_1234567890abcdef";
    const masked = maskSecret(secret, 4);

    assert.ok(masked.startsWith("••••••••••••"));
    assert.ok(masked.endsWith("cdef"));
  });

  await t.test("isMasked accurately identifies masked inputs", () => {
    assert.equal(isMasked("••••••••••••cdef"), true);
    assert.equal(isMasked("••••••••"), true);
    assert.equal(isMasked("test_fresh_token_1234"), false);
    assert.equal(isMasked(""), false);
  });
});

test("StoreSettings: Database Service logic & Endpoints", async (t) => {
  await connectDB();

  await t.test("getAllSettings returns full masked settings object", async () => {
    const settings = await StoreSettingsService.getAllSettings();
    assert.ok(settings.store);
    assert.ok(settings.currency);
    assert.ok(settings.payment);
    assert.ok(settings.shipping);
    assert.ok(settings.tax);
    assert.ok(settings.notification);
    assert.ok(settings.security);
  });

  await t.test("getPublicSettings returns storefront safe configuration", async () => {
    const pub = await StoreSettingsService.getPublicSettings();
    assert.ok(pub.storeName);
    assert.ok(pub.branding);
    assert.ok(pub.currency);
    assert.ok(pub.maintenance);
  });

  await t.test("getRobotsTxt produces valid crawler directives", async () => {
    const robots = await StoreSettingsService.getRobotsTxt();
    assert.ok(typeof robots === "string");
    assert.ok(robots.includes("User-agent:"));
    assert.ok(robots.includes("Disallow: /admin"));
  });

  await t.test("getSitemapXml outputs valid XML sitemap standard", async () => {
    const sitemap = await StoreSettingsService.getSitemapXml();
    assert.ok(typeof sitemap === "string");
    assert.ok(sitemap.startsWith("<?xml"));
    assert.ok(sitemap.includes("<urlset"));
    assert.ok(sitemap.includes("<loc>"));
  });

  await t.test("exportData formats records into valid CSV", async () => {
    const csv = await StoreSettingsService.exportData("products", "csv");
    assert.ok(typeof csv === "string");
  });

  await disconnectDB();
});
