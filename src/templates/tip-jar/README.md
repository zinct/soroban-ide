# Tip Jar — Soroban + React

Creator micropayments: record tips on-chain and show a running total.

```
tip-jar/
├── contracts/tip_jar/    # TipJarContract (tip, get_total, get_tip_count)
├── frontend/
└── Cargo.toml
```

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `tip(amount)` | write | Add a tip, return new total |
| `get_total()` | read | Running tip total |
| `get_tip_count()` | read | Number of tips recorded |

## Quick start

Create from **Browse Fullstack Examples** → deploy `contracts/tip_jar` → Preview → send tips with Freighter.
