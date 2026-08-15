# Gitcoin

Gitcoin pays users in **gits** (tokens) for building websites on GitHub Pages.
Each website page earns its creator a Gitcoin token – a digitally-signed proof of
ownership with a unique QR-scannable identifier.

## How it works

1. **Mint** – when you push to your GitHub Pages repository, a GitHub Actions
   workflow automatically mints a Gitcoin token (a JSON file in `tokens/`).
2. **Validate** – the token is run through a safety & index checker before it
   is accepted. Checks include HTTPS URL enforcement, checksum verification,
   and secret-pattern scanning.
3. **Wallet** – each token mint credits the owner's wallet with 1 git.
   Gits can be transferred between users.
4. **QR identifier** – every token carries a `qr_data` field encoded as
   `gitcoin://<owner>/<repo>/<id>?url=<page>` which can be rendered as a
   standard QR code for scanning.

## Quick start

### Prerequisites
- Node.js ≥ 18
- A GitHub repository with GitHub Pages enabled
- A `GHP_TOKEN` repository secret (GitHub Personal Access Token with `repo` scope)

### Mint a token manually

```bash
node src/token/mint.js \
  --owner  your-github-username \
  --repo   your-github-username/your-repo \
  --url    https://your-github-username.github.io/your-repo/ \
  --title  "My Awesome Site"
```

### Validate a token

```bash
node src/validator/check.js --token tokens/<id>.json
```

### Wallet commands

```bash
# Check balance
node src/wallet/wallet.js balance --owner your-github-username

# List owned tokens
node src/wallet/wallet.js list --owner your-github-username

# Transfer gits to another user
node src/wallet/wallet.js transfer \
  --from your-github-username \
  --to   friend-username \
  --amount 1 \
  --token <token-id>
```

### Run tests

```bash
npm test
```

## Automatic token minting via GitHub Actions

Add the workflow at `.github/workflows/mint-token.yml` to your repository.
Set the `GHP_TOKEN` secret in *Settings → Secrets and variables → Actions*.

Every push that modifies HTML, Markdown, JSON, or `docs/` files will
automatically:
1. Mint a new token in `tokens/`
2. Validate it
3. Credit your wallet
4. Commit the token file back to the repository

## Repository layout

```
.
├── .github/
│   └── workflows/
│       └── mint-token.yml    # Auto-mint workflow
├── src/
│   ├── token/
│   │   ├── mint.js           # Token minting logic
│   │   └── schema.json       # JSON Schema for tokens
│   ├── validator/
│   │   └── check.js          # Safety & index checks
│   └── wallet/
│       └── wallet.js         # Wallet registry
├── tests/
│   └── token.test.js         # Unit tests (no external deps)
├── tokens/                   # Minted token files (auto-generated)
│   └── wallets.json          # Wallet registry (auto-generated)
└── package.json
```

## Token structure

```json
{
  "id": "<uuid-v4>",
  "owner": "github-username",
  "repo": "owner/repo",
  "page_url": "https://owner.github.io/repo/",
  "title": "My Site",
  "commit_sha": "<sha>",
  "created_at": "<ISO-8601>",
  "checksum": "<sha256>",
  "qr_data": "gitcoin://owner/repo/<id>?url=...",
  "safety": { "passed": true, "checks": [...] },
  "wallet": { "balance": 1, "transactions": [...] }
}
```
<script src="https://www-infinity4.github.io/Mint-For-Infinity/infinity-wallet-menu.js" defer></script>
