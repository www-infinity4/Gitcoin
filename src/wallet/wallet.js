/**
 * Gitcoin Wallet Registry
 *
 * Maintains a per-user wallet registry stored as a JSON file.
 * Each wallet tracks:
 *  - total git balance
 *  - list of owned token IDs
 *  - full transaction history
 *
 * Usage (Node.js >= 18):
 *   node wallet.js balance  --owner <user>
 *   node wallet.js transfer --from <user> --to <user> --amount <n> --token <id>
 *   node wallet.js list     --owner <user>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {GITCOIN_OWNER,assertOwner}=require('../owner-policy');

const DEFAULT_REGISTRY = path.join(__dirname, '../../tokens/wallets.json');

/**
 * Load the wallet registry from disk, or return an empty one.
 * @param {string} registryPath
 * @returns {object} registry map keyed by owner username
 */
function loadRegistry(registryPath = DEFAULT_REGISTRY) {
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  }
  return {};
}

/**
 * Persist the registry to disk.
 * @param {object} registry
 * @param {string} registryPath
 */
function saveRegistry(registry, registryPath = DEFAULT_REGISTRY) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
}

/**
 * Ensure a wallet entry exists for the given owner.
 * @param {object} registry
 * @param {string} owner
 */
function ensureWallet(registry, owner) {
  assertOwner(owner);
  if (!registry[owner]) {
    registry[owner] = {
      owner,
      balance: 0,
      tokens: [],
      transactions: [],
    };
  }
}

/**
 * Credit a wallet when a token is minted.
 * @param {string} owner
 * @param {string} tokenId
 * @param {number} amount
 * @param {string} [registryPath]
 */
function credit(owner, tokenId, amount = 1, registryPath = DEFAULT_REGISTRY) {
  assertOwner(owner);
  if (amount !== 1) throw new Error('gitcoin_one_per_receipt');
  if (typeof tokenId !== 'string' || !/^[A-Za-z0-9:_-]{3,160}$/.test(tokenId))
    throw new Error('gitcoin_invalid_receipt');
  const registry = loadRegistry(registryPath);
  ensureWallet(registry, owner);
  const wallet = registry[owner];
  if (!Array.isArray(wallet.tokens) || !Array.isArray(wallet.transactions) ||
      !Number.isSafeInteger(wallet.balance) || wallet.balance < 0)
    throw new Error('gitcoin_invalid_wallet');
  // The token receipt is the idempotency key. A retry cannot credit again.
  if (wallet.tokens.includes(tokenId)) return wallet;
  wallet.balance += 1;
  wallet.tokens.push(tokenId);
  wallet.transactions.push({
    type: 'mint',
    amount: 1,
    token_id: tokenId,
    counterparty: null,
    timestamp: new Date().toISOString(),
  });
  saveRegistry(registry, registryPath);
  return wallet;
}

/**
 * Transfer gits from one wallet to another.
 * @param {string} from
 * @param {string} to
 * @param {number} amount
 * @param {string} tokenId - token being referenced in the trade
 * @param {string} [registryPath]
 * @returns {{ from: object, to: object }}
 */
function transfer(from, to, amount, tokenId, registryPath = DEFAULT_REGISTRY) {
  // GIT is earned only by the owner. Customer balances/transfers belong
  // to other separately named assets, never this owner-only issuer.
  throw new Error('gitcoin_owner_only_not_transferable');
}

/**
 * Get the wallet for a given owner.
 * @param {string} owner
 * @param {string} [registryPath]
 * @returns {object|null}
 */
function getWallet(owner, registryPath = DEFAULT_REGISTRY) {
  if (owner !== GITCOIN_OWNER) return null;
  const registry = loadRegistry(registryPath);
  return registry[owner] || null;
}

// ── CLI entry-point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const [, , command, ...rest] = process.argv;
  const get = (flag) => {
    const idx = rest.indexOf(flag);
    return idx !== -1 ? rest[idx + 1] : undefined;
  };

  try {
    switch (command) {
      case 'balance': {
        const owner = get('--owner');
        if (!owner) throw new Error('--owner is required');
        const wallet = getWallet(owner);
        if (!wallet) {
          console.log(`No wallet found for ${owner}`);
        } else {
          console.log(`Balance for ${owner}: ${wallet.balance} git(s)`);
          console.log(`Tokens owned: ${wallet.tokens.length}`);
        }
        break;
      }
      case 'transfer': {
        const from = get('--from');
        const to = get('--to');
        const amount = parseInt(get('--amount') || '1', 10);
        const tokenId = get('--token') || '';
        if (!from || !to) throw new Error('--from and --to are required');
        const result = transfer(from, to, amount, tokenId);
        console.log(`✅ Transferred ${amount} git(s) from ${from} to ${to}`);
        console.log(`   ${from} new balance: ${result.from.balance}`);
        console.log(`   ${to} new balance: ${result.to.balance}`);
        break;
      }
      case 'list': {
        const owner = get('--owner');
        if (!owner) throw new Error('--owner is required');
        const wallet = getWallet(owner);
        if (!wallet) {
          console.log(`No wallet found for ${owner}`);
        } else {
          console.log(`Tokens for ${owner}:`);
          wallet.tokens.forEach((id) => console.log(`  - ${id}`));
        }
        break;
      }
      default:
        console.error('Usage: node wallet.js <balance|transfer|list> [options]');
        process.exit(1);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

module.exports = { credit, transfer, getWallet, loadRegistry, saveRegistry, ensureWallet, GITCOIN_OWNER };
