# Split Bill — Soroban + React

Roommates split a shared bill: set the total, track how much has been paid.

```
invoice-split/
├── contracts/invoice_split/
├── frontend/
└── Cargo.toml
```

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `set_bill(total)` | write | Set bill amount |
| `pay_share(amount)` | write | Pay toward the bill |
| `get_status()` | read | `{ bill_total, paid_total }` |

## Quick start

**Browse Fullstack Examples** → **Split Bill** → deploy → set bill → pay shares.
