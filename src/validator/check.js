/**
 * Gitcoin Token Validator
 *
 * Runs a series of safety and index checks on a website page before
 * a Gitcoin token can be considered valid (safety.passed = true).
 *
 * Checks performed:
 *  1. url_format    – page_url is a valid HTTPS URL
 *  2. owner_match   – URL hostname contains the owner or repo name
 *  3. checksum      – token checksum matches recomputed value
 *  4. title_present – token has a non-empty title
 *  5. no_secrets    – token JSON does not contain obvious secret patterns
 *
 * Usage (Node.js >= 18):
 *   node check.js --token <path/to/token.json>
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');

/**
 * Recompute the checksum exactly as mint.js does.
 * @param {object} token
 * @returns {string}
 */
function recomputeChecksum(token) {
  return crypto
    .createHash('sha256')
    .update([token.id, token.owner, token.repo, token.page_url, token.created_at].join('|'))
    .digest('hex');
}

/**
 * Individual check definitions.
 * Each check receives the token object and returns { passed, detail }.
 */
const CHECKS = [
  {
    name: 'url_format',
    run(token) {
      try {
        const u = new URL(token.page_url);
        const passed = u.protocol === 'https:';
        return { passed, detail: passed ? 'URL is HTTPS' : `Protocol must be https, got ${u.protocol}` };
      } catch {
        return { passed: false, detail: 'page_url is not a valid URL' };
      }
    },
  },
  {
    name: 'owner_match',
    run(token) {
      const hostname = (() => {
        try { return new URL(token.page_url).hostname.toLowerCase(); } catch { return ''; }
      })();
      const owner = (token.owner || '').toLowerCase();
      const repo = (token.repo || '').split('/').pop().toLowerCase();
      const passed = hostname.includes(owner) || hostname.includes(repo);
      return {
        passed,
        detail: passed
          ? `Hostname ${hostname} matches owner or repo`
          : `Hostname ${hostname} does not contain owner "${owner}" or repo "${repo}"`,
      };
    },
  },
  {
    name: 'checksum',
    run(token) {
      const expected = recomputeChecksum(token);
      const passed = expected === token.checksum;
      return {
        passed,
        detail: passed ? 'Checksum verified' : `Checksum mismatch: expected ${expected}`,
      };
    },
  },
  {
    name: 'title_present',
    run(token) {
      const passed = typeof token.title === 'string' && token.title.trim().length > 0;
      return { passed, detail: passed ? 'Title is present' : 'Token must have a non-empty title' };
    },
  },
  {
    name: 'no_secrets',
    run(token) {
      // Rudimentary check: reject tokens whose JSON contains common secret patterns.
      const raw = JSON.stringify(token);
      const patterns = [/ghp_[A-Za-z0-9]{40}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/];
      for (const pat of patterns) {
        if (pat.test(raw)) {
          return { passed: false, detail: `Possible secret detected matching ${pat}` };
        }
      }
      return { passed: true, detail: 'No secret patterns found' };
    },
  },
];

/**
 * Run all checks against a token and return the updated token.
 * Sets token.safety.passed, token.safety.checked_at, and token.safety.checks.
 *
 * @param {object} token - parsed Gitcoin token object
 * @returns {object} token with safety fields populated
 */
function validateToken(token) {
  const results = CHECKS.map(({ name, run }) => {
    const { passed, detail } = run(token);
    return { name, passed, detail };
  });

  const allPassed = results.every((r) => r.passed);

  token.safety = {
    passed: allPassed,
    checked_at: new Date().toISOString(),
    checks: results,
  };

  return token;
}

// ── CLI entry-point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--token');
  const tokenPath = idx !== -1 ? args[idx + 1] : null;

  if (!tokenPath) {
    console.error('Usage: node check.js --token <path/to/token.json>');
    process.exit(1);
  }

  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const validated = validateToken(token);
    fs.writeFileSync(tokenPath, JSON.stringify(validated, null, 2) + '\n');

    const failed = validated.safety.checks.filter((c) => !c.passed);
    if (validated.safety.passed) {
      console.log(`✅ Token ${token.id} passed all checks`);
    } else {
      console.log(`⚠️  Token ${token.id} failed ${failed.length} check(s):`);
      failed.forEach((c) => console.log(`   ✗ ${c.name}: ${c.detail}`));
    }
    process.exit(validated.safety.passed ? 0 : 1);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

module.exports = { validateToken, CHECKS, recomputeChecksum };
