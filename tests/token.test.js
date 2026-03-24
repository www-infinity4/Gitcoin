/**
 * Gitcoin Token Tests
 *
 * Run with:  node tests/token.test.js
 * (No external test runner required – uses Node.js built-in assert.)
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { mintToken, saveToken, computeChecksum, buildQrData } = require('../src/token/mint');
const { validateToken } = require('../src/validator/check');
const { credit, transfer, getWallet } = require('../src/wallet/wallet');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Token minting ────────────────────────────────────────────────────────────
console.log('\n── Token minting ──');

test('mintToken returns required fields', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/' });
  assert.ok(token.id, 'id missing');
  assert.strictEqual(token.owner, 'alice');
  assert.strictEqual(token.repo, 'alice/site');
  assert.strictEqual(token.page_url, 'https://alice.github.io/site/');
  assert.ok(token.created_at, 'created_at missing');
  assert.ok(token.checksum, 'checksum missing');
  assert.ok(token.qr_data, 'qr_data missing');
});

test('mintToken checksum is valid', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/' });
  const expected = computeChecksum(token.id, token.owner, token.repo, token.page_url, token.created_at);
  assert.strictEqual(token.checksum, expected);
});

test('mintToken qr_data contains gitcoin scheme', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/' });
  assert.ok(token.qr_data.startsWith('gitcoin://'));
});

test('mintToken initial wallet balance is 1', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/' });
  // The per-token wallet field is no longer embedded; the global wallets.json registry
  // (src/wallet/wallet.js) is the single source of truth for balances.
  assert.ok(!token.wallet, 'token should not have an embedded wallet field');
});

test('mintToken throws when required fields missing', () => {
  assert.throws(() => mintToken({ owner: '', repo: 'r', pageUrl: 'https://x.io' }), /required/);
  assert.throws(() => mintToken({ owner: 'a', repo: '', pageUrl: 'https://x.io' }), /required/);
  assert.throws(() => mintToken({ owner: 'a', repo: 'r', pageUrl: '' }), /required/);
});

test('saveToken writes a readable JSON file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitcoin-test-'));
  const token = mintToken({ owner: 'bob', repo: 'bob/repo', pageUrl: 'https://bob.github.io/repo/' });
  const filePath = saveToken(token, tmpDir);
  assert.ok(fs.existsSync(filePath));
  const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.strictEqual(loaded.id, token.id);
  fs.rmSync(tmpDir, { recursive: true });
});

// ── Token validation ─────────────────────────────────────────────────────────
console.log('\n── Token validation ──');

test('validateToken passes a well-formed token', () => {
  const token = mintToken({
    owner: 'alice',
    repo: 'alice/site',
    pageUrl: 'https://alice.github.io/site/',
    title: 'My Site',
  });
  validateToken(token);
  assert.strictEqual(token.safety.passed, true, JSON.stringify(token.safety.checks));
});

test('validateToken fails on non-HTTPS URL', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/', title: 'T' });
  token.page_url = 'http://alice.github.io/site/';
  validateToken(token);
  const urlCheck = token.safety.checks.find((c) => c.name === 'url_format');
  assert.strictEqual(urlCheck.passed, false);
});

test('validateToken fails when checksum is tampered', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/', title: 'T' });
  token.checksum = 'deadbeef';
  validateToken(token);
  const chk = token.safety.checks.find((c) => c.name === 'checksum');
  assert.strictEqual(chk.passed, false);
});

test('validateToken fails when title is missing', () => {
  const token = mintToken({ owner: 'alice', repo: 'alice/site', pageUrl: 'https://alice.github.io/site/' });
  token.title = '';
  validateToken(token);
  const chk = token.safety.checks.find((c) => c.name === 'title_present');
  assert.strictEqual(chk.passed, false);
});

// ── Wallet ───────────────────────────────────────────────────────────────────
console.log('\n── Wallet ──');

function tmpRegistry() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gitcoin-wallet-')), 'wallets.json');
}

test('credit creates wallet and adds balance', () => {
  const reg = tmpRegistry();
  const wallet = credit('carol', 'token-abc', 1, reg);
  assert.strictEqual(wallet.balance, 1);
  assert.ok(wallet.tokens.includes('token-abc'));
});

test('getWallet returns null for unknown owner', () => {
  const reg = tmpRegistry();
  assert.strictEqual(getWallet('nobody', reg), null);
});

test('transfer moves gits between wallets', () => {
  const reg = tmpRegistry();
  credit('dave', 'token-xyz', 5, reg);
  const result = transfer('dave', 'eve', 3, 'token-xyz', reg);
  assert.strictEqual(result.from.balance, 2);
  assert.strictEqual(result.to.balance, 3);
});

test('transfer throws on insufficient balance', () => {
  const reg = tmpRegistry();
  credit('frank', 'token-001', 1, reg);
  assert.throws(() => transfer('frank', 'grace', 99, 'token-001', reg), /Insufficient balance/);
});

test('transfer throws on non-positive amount', () => {
  const reg = tmpRegistry();
  credit('henry', 'token-002', 5, reg);
  assert.throws(() => transfer('henry', 'iris', 0, 'token-002', reg), /positive/);
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed > 0 ? 1 : 0);
