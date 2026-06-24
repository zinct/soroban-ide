/**
 * Wallet bridge between the in-IDE preview iframe (blob: origin) and the
 * parent Soroban IDE window. Freighter cannot inject into blob URLs, so
 * contract write actions postMessage to the parent, which opens Freighter
 * on the real IDE origin and returns the signed XDR.
 */

import { logPreviewActivity } from "./previewConsoleBridge";

export const PREVIEW_WALLET_REQUEST = "soroban:walletRequest";
export const PREVIEW_WALLET_RESPONSE = "soroban:walletResponse";
export const PREVIEW_WALLET_SYNC = "soroban:wallet";
export const PREVIEW_CONTRACT_SYNC = "soroban:contract";

/** Injected into preview HTML so bundled apps can detect the IDE iframe. */
export const PREVIEW_FLAG_SCRIPT = `<script>window.__SOROBAN_IDE_PREVIEW__=true;</script>`;

/** Seed contract id before the React bundle runs (overrides stale build-time .env). */
export const buildPreviewContractScript = (contractId = "") => {
  const id = (contractId ?? "").toString().trim();
  return `<script>window.__SOROBAN_PREVIEW_CONTRACT__=${JSON.stringify(id)};</script>`;
};

const FREIGHTER_EXPORTS = [
  "getAddress", "isConnected", "requestAccess", "signTransaction",
  "signMessage", "signAuthEntry", "getNetwork", "getNetworkDetails",
  "isAllowed", "setAllowed", "addToken", "WatchWalletChanges",
];

const BRIDGED_METHODS = new Set([
  "requestAccess",
  "getAddress",
  "isConnected",
  "signTransaction",
  "signMessage",
  "signAuthEntry",
]);

/**
 * esbuild onLoad body for @stellar/freighter-api — wraps CDN exports so
 * preview iframes route wallet calls to the parent IDE window.
 */
export function buildPreviewFreighterShimContents(esmUrl) {
  const nativeExports = FREIGHTER_EXPORTS.map(
    (name) => `const __${name} = __pkg[${JSON.stringify(name)}];`,
  ).join("\n");

  const reExports = FREIGHTER_EXPORTS.map((name) => {
    if (BRIDGED_METHODS.has(name)) {
      return `export async function ${name}(...args) {
  if (__isIdePreview()) return __bridge("${name}", args);
  return __${name}(...args);
}`;
    }
    return `export const ${name} = __${name};`;
  }).join("\n");

  return [
    `import __pkg from ${JSON.stringify(esmUrl)};`,
    nativeExports,
    "",
    "const __pending = new Map();",
    "let __seq = 0;",
    "",
    "const __isIdePreview = () => typeof window !== \"undefined\" && (",
    "  window.__SOROBAN_IDE_PREVIEW__ === true",
    "  || (window.parent !== window && window.location.protocol === \"blob:\")",
    ");",
    "",
    "const __bridge = (method, args) => new Promise((resolve, reject) => {",
    "  if (typeof window.__sorobanPreviewLog === \"function\") {",
    "    window.__sorobanPreviewLog(\"info\", \"[wallet] \" + method + \" requested\");",
    "  }",
    "  const id = String(++__seq);",
    "  __pending.set(id, { resolve, reject });",
    "  window.parent.postMessage({",
    "    source: \"soroban-preview\",",
    `    type: ${JSON.stringify(PREVIEW_WALLET_REQUEST)},`,
    "    id, method, params: { args },",
    "  }, \"*\");",
    "  setTimeout(() => {",
    "    if (!__pending.has(id)) return;",
    "    __pending.delete(id);",
    "    reject(new Error(\"Wallet request timed out — connect Freighter in the Deploy panel, then try again.\"));",
    "  }, 120000);",
    "});",
    "",
    "if (typeof window !== \"undefined\") {",
    "  window.addEventListener(\"message\", (event) => {",
    "    const data = event.data;",
    `    if (data?.source !== \"soroban-ide\" || data?.type !== ${JSON.stringify(PREVIEW_WALLET_RESPONSE)}) return;`,
    "    const pending = __pending.get(data.id);",
    "    if (!pending) return;",
    "    __pending.delete(data.id);",
    "    if (data.ok) {",
    "      if (typeof window.__sorobanPreviewLog === \"function\") {",
    "        window.__sorobanPreviewLog(\"info\", \"[wallet] \" + (data.method || \"call\") + \" succeeded\");",
    "      }",
    "      pending.resolve(data.result);",
    "    } else {",
    "      if (typeof window.__sorobanPreviewLog === \"function\") {",
    "        window.__sorobanPreviewLog(\"error\", \"[wallet] failed: \" + (data.error || \"unknown\"));",
    "      }",
    "      pending.reject(new Error(data.error || \"Wallet request failed\"));",
    "    }",
    "  });",
    "}",
    "",
    reExports,
    "export default __pkg;",
  ].join("\n");
}

/**
 * Handle a wallet request posted from the preview iframe.
 */
export async function handlePreviewWalletRequest(data, {
  eventSource,
  walletAddress,
  walletNetworkPassphrase,
  connectWallet,
  signTransaction,
}) {
  const respond = (payload) => {
    if (eventSource && typeof eventSource.postMessage === "function") {
      eventSource.postMessage(
        {
          source: "soroban-ide",
          type: PREVIEW_WALLET_RESPONSE,
          id: data.id,
          method: data.method,
          ...payload,
        },
        "*",
      );
    }
  };

  const ensureWallet = async () => {
    if (walletAddress) return walletAddress;
    const address = await connectWallet();
    if (!address) throw new Error("Connect Freighter in the Deploy panel to sign transactions.");
    return address;
  };

  const shortAddr = (addr) => (
    addr && addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr || ""
  );

  try {
    const args = data.params?.args || [];
    logPreviewActivity(`[wallet] ${data.method} → opening Freighter`);

    switch (data.method) {
      case "requestAccess": {
        const address = await ensureWallet();
        logPreviewActivity(`[wallet] requestAccess ✓ ${shortAddr(address)}`);
        respond({ ok: true, result: { address } });
        break;
      }
      case "getAddress": {
        if (!walletAddress) {
          respond({ ok: true, result: {} });
          break;
        }
        respond({ ok: true, result: { address: walletAddress } });
        break;
      }
      case "isConnected": {
        respond({ ok: true, result: { isConnected: Boolean(walletAddress) } });
        break;
      }
      case "signTransaction": {
        const [xdr, opts = {}] = args;
        const address = opts.address || await ensureWallet();
        const networkPassphrase = opts.networkPassphrase || walletNetworkPassphrase;
        logPreviewActivity(`[wallet] signTransaction for ${shortAddr(address)}…`);
        const signedTxXdr = await signTransaction(xdr, address, networkPassphrase);
        logPreviewActivity("[wallet] signTransaction ✓ signed");
        respond({ ok: true, result: { signedTxXdr } });
        break;
      }
      case "signMessage": {
        const [message, opts = {}] = args;
        const address = opts.address || await ensureWallet();
        logPreviewActivity(`[wallet] signMessage for ${shortAddr(address)}…`);
        const { signMessage } = await import("@stellar/freighter-api");
        const result = await signMessage(message, {
          ...opts,
          ...(address ? { address } : {}),
        });
        if (result?.error) throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
        logPreviewActivity("[wallet] signMessage ✓ signed");
        respond({ ok: true, result });
        break;
      }
      case "signAuthEntry": {
        const [entryXdr, opts = {}] = args;
        const address = opts.address || await ensureWallet();
        logPreviewActivity(`[wallet] signAuthEntry for ${shortAddr(address)}…`);
        const { signAuthEntry } = await import("@stellar/freighter-api");
        const result = await signAuthEntry(entryXdr, {
          ...opts,
          ...(address ? { address } : {}),
        });
        if (result?.error) throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
        logPreviewActivity("[wallet] signAuthEntry ✓ signed");
        respond({ ok: true, result });
        break;
      }
      default:
        logPreviewActivity(`[wallet] unsupported method: ${data.method}`, "warn");
        respond({ ok: false, error: `Unsupported wallet method: ${data.method}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logPreviewActivity(`[wallet] ${data.method} ✗ ${msg}`, "error");
    respond({
      ok: false,
      error: msg,
    });
  }
}
