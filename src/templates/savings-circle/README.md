# Savings Circle — Soroban + React

Community savings pool: members contribute to a shared on-chain total.

```
savings-circle/
├── contracts/savings_circle/
├── frontend/
└── Cargo.toml
```

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `contribute(amount)` | write | Add to pool, return total |
| `get_total()` | read | Pool balance |
| `get_contribution_count()` | read | Number of contributions |

## Quick start

**Browse Fullstack Examples** → **Savings Circle** → deploy → Preview → contribute.
