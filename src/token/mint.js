/**
 * Gitcoin Token Minter
 *
 * Mints a new Gitcoin token for a given GitHub Pages website.
 * Produces a token JSON file and a QR data string that can be
 * rendered as a QR code to prove ownership.
 *
 * Usage (Node.js >= 18):
 *   node mint.js --owner <user> --repo <owner/repo> --url <page_url> \
 *                [--title <title>] [--description <desc>] [--sha <commit_sha>]
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate a UUID v4 using the built-in crypto module.
 * @returns {string}
 */
function uuidv4() {
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * Compute the SHA-256 checksum of the token's canonical fields.
 * @param {string} id
 * @param {string} owner
 * @param {string} repo
 * @param {string} pageUrl
 * @param {string} createdAt
 * @returns {string} hex digest
 */
function computeChecksum(id, owner, repo, pageUrl, createdAt) {
  return crypto
    .createHash('sha256')
    .update([id, owner, repo, pageUrl, createdAt].join('|'))
    .digest('hex');
}

/**
 * Build the compact QR data string for a token.
 * Format: gitcoin://<owner>/<repo>/<id>?url=<encoded_url>
 * @param {string} id
 * @param {string} owner
 * @param {string} repo
 * @param {string} pageUrl
 * @returns {string}
 */
function buildQrData(id, owner, repo, pageUrl) {
  const encoded = encodeURIComponent(pageUrl);
  return `gitcoin://${owner}/${repo}/${id}?url=${encoded}`;
}

/**
 * Mint a new Gitcoin token.
 *
 * @param {object} opts
 * @param {string} opts.owner     - GitHub username
 * @param {string} opts.repo      - owner/repo string
 * @param {string} opts.pageUrl   - URL of the website page
 * @param {string} [opts.title]   - Page title
 * @param {string} [opts.description] - Short description
 * @param {string} [opts.commitSha]   - Git commit SHA
 * @returns {object} Gitcoin token object
 */
function mintToken({ owner, repo, pageUrl, title = '', description = '', commitSha = '' }) {
  if (!owner || !repo || !pageUrl) {
    throw new Error('owner, repo, and pageUrl are required');
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const checksum = computeChecksum(id, owner, repo, pageUrl, createdAt);
  const qrData = buildQrData(id, owner, repo, pageUrl);

  return {
    id,
    owner,
    repo,
    page_url: pageUrl,
    title,
    description,
    commit_sha: commitSha,
    created_at: createdAt,
    checksum,
    qr_data: qrData,
    safety: {
      passed: false,
      checked_at: null,
      checks: [],
    },
  };
}

/**
 * Save a token to the tokens/ directory as <id>.json.
 * @param {object} token
 * @param {string} outDir - directory to write into
 * @returns {string} absolute path of the written file
 */
function saveToken(token, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `${token.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(token, null, 2) + '\n');
  return filePath;
}

// ── CLI entry-point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const owner = get('--owner');
  const repo = get('--repo');
  const pageUrl = get('--url');
  const title = get('--title') || '';
  const description = get('--description') || '';
  const commitSha = get('--sha') || process.env.GITHUB_SHA || '';
  const outDir = get('--out') || path.join(__dirname, '../../tokens');

  try {
    const token = mintToken({ owner, repo, pageUrl, title, description, commitSha });
    const filePath = saveToken(token, outDir);
    console.log(`✅ Token minted: ${token.id}`);
    console.log(`   QR data : ${token.qr_data}`);
    console.log(`   Saved to: ${filePath}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

module.exports = { mintToken, saveToken, computeChecksum, buildQrData, uuidv4 };
