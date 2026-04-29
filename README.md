<div align="center">

<img src="public/assets/images/soroban.png" alt="Soroban Studio" width="120" />

# Soroban Studio

### The modern, browser-based IDE for Stellar Soroban smart contracts.

Build, test, and deploy Rust smart contracts on the Stellar network — without leaving your browser.

<br />

<!-- Ecosystem badges -->
<a href="https://stellar.org">
  <img alt="Built for Stellar" src="https://img.shields.io/badge/Built%20for-Stellar-000000?style=for-the-badge&logo=stellar&logoColor=white" />
</a>
<a href="https://developers.stellar.org/docs/build/smart-contracts">
  <img alt="Powered by Soroban" src="https://img.shields.io/badge/Powered%20by-Soroban-7D00FF?style=for-the-badge&logo=stellar&logoColor=white" />
</a>
<a href="https://www.rust-lang.org/">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" />
</a>

<br />

<!-- Tech badges -->
<a href="https://react.dev/">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
</a>
<a href="https://vitejs.dev/">
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
</a>
<a href="https://microsoft.github.io/monaco-editor/">
  <img alt="Monaco Editor" src="https://img.shields.io/badge/Monaco-Editor-0078D4?logo=visualstudiocode&logoColor=white" />
</a>
<a href="https://nodejs.org/">
  <img alt="Node 20.19+" src="https://img.shields.io/badge/node-%E2%89%A520.19-5FA04E?logo=nodedotjs&logoColor=white" />
</a>
<img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen" />

<br /><br />

<p>
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#environment-variables">Environment</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#contributing">Contributing</a>
</p>

</div>

---

## About

**Soroban Studio** is an open-source, VS Code–style IDE designed specifically for developers building on [Stellar](https://stellar.org) with [Soroban](https://developers.stellar.org/docs/build/smart-contracts). It provides a polished in-browser development environment — Monaco editor, project templates, an integrated terminal wired to a Go build service, GitHub clone, [Freighter](https://www.freighter.app/) wallet integration, and a command palette — so you can go from zero to a deployed contract without context-switching between tools.

> **Repository:** [`zinct/soroban-ide`](https://github.com/zinct/soroban-ide)

---

## Features

- **Monaco code editor** with Rust, TOML, JSON, and Markdown syntax highlighting.
- **File explorer** with drag-and-drop, rename, copy/cut/paste, and context menus.
- **Tabs** with VS Code–style preview behavior (single-click preview, edit to pin).
- **Integrated terminal** that streams `stellar` CLI output from the backend over WebSocket, plus local commands (`ls`, `cd`, `clear`, …).
- **One-click project templates** — `hello-world` contract and the `stellar-workshop` starter.
- **GitHub integration** — OAuth sign-in and clone of public repositories into the workspace.
- **Contract Selector in Deploy panel** — auto-discovers `Cargo.toml` projects, persists selection, and scopes build/deploy to the selected contract.
- **Deploy timeline (multi-contract history)** — grouped deploy history with timestamps, active/previous states, inline Explorer links, and one-click re-activate.
- **Deploy timeline controls** — search by alias/ID/path, filter by wallet/network/contract, pin favorites, and compare deployment diffs (metadata + function set).
- **Inline contract testing from deploy history** — invoke read/write functions directly from each deployed contract card.
- **Freighter wallet integration** — connect, deploy with Freighter signing flow, and interact with deployed contracts.
- **Improved Freighter diagnostics** — clearer sign/submit/on-chain error stages with decoded transaction result codes.
- **Command Palette & Quick Open** — `Cmd/Ctrl+Shift+P` and `Cmd/Ctrl+P`.
- **Built-in tutorials** to guide new Soroban developers end-to-end.
- **Themes** — Community Dark and Modern Light.
- **Zero-config static deploy** — thanks to hash routing, deploys cleanly on Vercel, Netlify, Cloudflare Pages, or any static host.

---

## Tech Stack

| Layer       | Technology                                                            |
| ----------- | --------------------------------------------------------------------- |
| Framework   | [React 18](https://react.dev/) + [React Router](https://reactrouter.com/) (`createHashRouter`) |
| Build tool  | [Vite 8](https://vitejs.dev/)                                         |
| Editor      | [Monaco Editor](https://microsoft.github.io/monaco-editor/)           |
| Icons       | [Lucide React](https://lucide.dev/)                                   |
| Wallet      | [Freighter](https://www.freighter.app/)                               |
| Backend     | Go service (separate repo) exposed at `/api` — WebSocket build streaming |
| Contracts   | [Soroban SDK](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup) (Rust) |
| Deploy UX   | Multi-contract deploy history, filters, pinning, diff modal, inline invoke |

---

## Requirements

- **Node.js** `>= 20.19` (enforced via `package.json` `engines`; required by Vite 8)
- **npm** `>= 10`
- *(Optional)* A running instance of the companion Go backend for `stellar build`, `stellar deploy`, and template fetching.

---

## Quick Start

```bash
git clone https://github.com/zinct/soroban-ide.git
cd soroban-ide
npm install
cp .env.example .env     # fill in the values you need
npm run dev              # http://localhost:3000
```

Vite proxies `/api` → `http://localhost:8080` in dev (see `vite.config.js`), so a locally-running backend needs no CORS setup.

### Scripts

| Script            | Description                                       |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server on port `3000`.         |
| `npm run build`   | Produce a production build in `dist/`.            |
| `npm run preview` | Serve the built `dist/` locally for a smoke test. |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable                | Scope         | Description                                                                 |
| ----------------------- | ------------- | --------------------------------------------------------------------------- |
| `VITE_GITHUB_CLIENT_ID` | Client (Vite) | GitHub OAuth App client ID. Used by the GitHub panel for sign-in and clone. |
| `VITE_API_BASE`         | Client (Vite) | Backend URL. Leave empty locally (defaults to `/api`, proxied by Vite). In production set to e.g. `https://api.soroban.studio`. |
| `BACKEND_URL`           | Server-side   | Upstream backend URL for serverless proxies (optional).                     |

> Only variables prefixed with `VITE_` are exposed to the browser bundle.

---

## Keyboard Shortcuts

| Action                  | macOS   | Windows / Linux    |
| ----------------------- | ------- | ------------------ |
| Command Palette         | `⌘⇧P`   | `Ctrl+Shift+P`     |
| Quick Open (Go to File) | `⌘P`    | `Ctrl+P`           |
| Save / promote preview  | `⌘S`    | `Ctrl+S`           |
| Close active tab        | `⌘W`    | `Ctrl+W`           |
| Toggle sidebar          | `⌘B`    | `Ctrl+B`           |
| Toggle terminal         | `⌘J`    | `Ctrl+J`           |
| Copy / Cut / Paste file | `⌘C/X/V` | `Ctrl+C/X/V`      |

---

## Architecture

```text
soroban-ide/
├── public/                 # Static assets (logos, icons, codicons)
├── src/
│   ├── app/                # Router (HashRouter)
│   ├── components/         # Layout, shared UI, icons
│   ├── context/            # Contract interaction context
│   ├── features/
│   │   ├── editor/         # Monaco wrapper + language utils
│   │   ├── github/         # GitHub OAuth + clone panel
│   │   ├── deploy/         # Build/deploy flow, contract discovery, deploy timeline
│   │   ├── interact/       # Freighter-based contract interaction
│   │   ├── palette/        # Command Palette + Quick Open
│   │   ├── settings/       # Theme and editor settings
│   │   ├── sidebar/        # File explorer, drag-and-drop, context menu
│   │   ├── tabs/           # Tab bar with preview-tab behavior
│   │   ├── terminal/       # Terminal UI + command routing
│   │   ├── tutorial/       # Interactive tutorials
│   │   └── workspace/      # Tree state, templates, hooks
│   ├── services/           # Backend, GitHub, Freighter clients
│   ├── styles/             # Per-feature CSS
│   └── utils/              # Storage, file-type helpers
├── vite.config.js
└── package.json
```

The Go backend lives in a separate repository and is consumed by the client at `/api` (WebSocket streaming for builds, REST for file and template operations).

---

## Contributing

Contributions are very welcome — bug reports, feature requests, and pull requests all help make the tooling around Soroban better for everyone.

Before opening a PR:

1. Run a clean install: `rm -rf node_modules package-lock.json && npm install` (no `--legacy-peer-deps`).
2. Verify the build: `npm run build`.
3. Keep commits scoped and follow the existing convention (`feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `docs:`).
4. For UI changes, include a before/after screenshot in your PR description when practical.

---

## Acknowledgements

Built with love for the [Stellar](https://stellar.org) developer community, and standing on the shoulders of open-source giants:

- [Stellar Development Foundation](https://stellar.org) — for Stellar and Soroban.
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — the editor that powers VS Code.
- [Vite](https://vitejs.dev/) · [React](https://react.dev/) · [Lucide](https://lucide.dev/) · [Freighter](https://www.freighter.app/).

<div align="center">
<sub>Made for the Stellar ecosystem · <a href="https://github.com/zinct/soroban-ide">zinct/soroban-ide</a></sub>
</div>
