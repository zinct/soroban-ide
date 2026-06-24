# Donation Vault — Soroban + React

Transparent NGO-style donations with a public on-chain total and donor count.

```
donation-vault/
├── contracts/donation_vault/
├── frontend/
└── Cargo.toml
```

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `donate(amount)` | write | Record donation, return total |
| `get_total()` | read | Public total raised |
| `get_donor_count()` | read | Number of donations |

## Quick start

**Browse Fullstack Examples** → **Donation Vault** → deploy → Preview → donate.
