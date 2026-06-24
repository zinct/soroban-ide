# Pay Escrow — Soroban + React

Freelancer milestone escrow demo: fund an escrow balance on-chain, then release when work is complete.

```
pay-escrow/
├── contracts/escrow/     # EscrowContract (fund, release, get)
├── frontend/             # Vite + React UI
└── Cargo.toml
```

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `fund(amount)` | write | Add demo units to escrow |
| `release()` | write | Mark released, return funded total |
| `get()` | read | `{ funded, released }` |

## Quick start in Soroban IDE

1. **Create project** → Browse Fullstack Examples → **Pay Escrow**
2. **Deploy** → select `contracts/escrow`, build & deploy on testnet
3. **Preview** → Rebuild, connect Freighter, fund then release

## Stellar stack

- Soroban smart contract (Rust)
- `@stellar/stellar-sdk` + Freighter for signing
- Testnet RPC simulation for reads

## Production notes

Wire real USDC/token transfers in `fund` / `release`. This template tracks escrow state only for hackathon demos.
