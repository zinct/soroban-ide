import { StrKey } from "@stellar/stellar-base";

/** Soroban JSON-RPC endpoints (public; browser CORS varies by provider). */
const RPC_TESTNET = "https://soroban-testnet.stellar.org";
const RPC_MAINNET = "https://soroban-mainnet.stellar.org";

/**
 * Collect README.md bodies from the flat project file map (case-insensitive name).
 * Shorter paths first (root README before nested).
 * @param {Record<string, string>} projectFiles
 * @returns {string[]}
 */
function collectReadmeBodies(projectFiles) {
  if (!projectFiles || typeof projectFiles !== "object") return [];
  const pairs = [];
  for (const [path, content] of Object.entries(projectFiles)) {
    if (!/(^|\/)readme\.md$/i.test(path)) continue;
    if (typeof content !== "string") continue;
    const t = content.trim();
    if (t) pairs.push({ path, content: t });
  }
  pairs.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
  return pairs.map((p) => p.content);
}

/**
 * Use the optional panel field if set; otherwise scan README.md file(s) in the project.
 * @param {string} panelTrimmed
 * @param {Record<string, string>} projectFiles — same shape as `collectProjectFiles` result
 * @returns {{ raw: string, source: "panel" | "readme" | "none" }}
 */
export function resolveDeployedLinkInput(panelTrimmed, projectFiles) {
  const panel = (panelTrimmed || "").trim();
  if (panel) return { raw: panel, source: "panel" };
  const bodies = collectReadmeBodies(projectFiles);
  if (bodies.length === 0) return { raw: "", source: "none" };
  return { raw: bodies.join("\n\n"), source: "readme" };
}

/** Appears in Soroban tx JSON (fee events) alongside deploy; do not treat as the student's contract when multiple C… IDs exist. */
const RESOURCE_FEE_CONTRACT_HINTS = new Set([
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // testnet resource fee (common in tx events)
]);

/**
 * 64-char hex transaction hashes from explorer / lab URLs (`/tx/…`, `/transaction/…`).
 * @param {string} raw
 * @returns {string[]} lowercase hashes, in order of appearance
 */
export function extractTxHashes(raw) {
  if (!raw || typeof raw !== "string") return [];
  const text = raw.trim();
  const seen = new Set();
  const out = [];
  const re = /\/(?:tx|transaction)\/([a-fA-F0-9]{64})/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const h = m[1].toLowerCase();
    if (h.length === 64 && !seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}

/**
 * @param {object} txResult — getTransaction `result` object (JSON shape)
 * @returns {string | null}
 */
function getSorobanReturnContractAddress(txResult) {
  const meta = txResult?.resultMetaJson;
  if (!meta || typeof meta !== "object") return null;
  for (const ver of Object.values(meta)) {
    const rv = ver?.soroban_meta?.return_value;
    const addr = rv?.address;
    if (typeof addr === "string" && StrKey.isValidContract(addr)) return addr;
  }
  return null;
}

function collectValidContractIdsFromTxJson(txResult) {
  try {
    const json = JSON.stringify(txResult);
    const re = /C[A-Z2-7]{55}/g;
    const found = new Set();
    let m;
    while ((m = re.exec(json)) !== null) {
      const id = m[0];
      if (StrKey.isValidContract(id)) found.add(id);
    }
    return [...found];
  } catch {
    return [];
  }
}

function pickDeployedContractFromTxResult(txResult) {
  const direct = getSorobanReturnContractAddress(txResult);
  if (direct) return direct;
  const candidates = collectValidContractIdsFromTxJson(txResult);
  const noFee = candidates.filter((id) => !RESOURCE_FEE_CONTRACT_HINTS.has(id));
  if (noFee.length === 1) return noFee[0];
  if (noFee.length > 1) return noFee[0];
  return candidates[0] ?? null;
}

async function rpcGetTransactionJson(rpcUrl, hashLower) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: { hash: hashLower, xdrFormat: "json" },
    }),
  });
  if (!res.ok) return { ok: false, httpError: res.status };
  const data = await res.json();
  if (data.error) return { ok: false, error: data.error.message || String(data.error) };
  const r = data.result;
  if (!r) return { ok: false, error: "Empty RPC result" };
  if (r.status === "NOT_FOUND") return { ok: false, notFound: true };
  if (r.status === "FAILED") return { ok: false, failed: true };
  if (r.status !== "SUCCESS") return { ok: false, error: r.status };
  return { ok: true, result: r };
}

/**
 * Resolve a deployed contract ID from stellar.expert / lab **transaction** links via Soroban RPC.
 * @returns {Promise<{ contractId: string, resolvedFromTxHash: string } | { error: string } | null>}
 */
async function resolveContractFromTxUrls(trimmed, hint) {
  const hashes = extractTxHashes(trimmed);
  if (hashes.length === 0) return null;

  const rpcOrder =
    hint === "mainnet"
      ? [RPC_MAINNET, RPC_TESTNET]
      : hint === "testnet"
        ? [RPC_TESTNET, RPC_MAINNET]
        : [RPC_TESTNET, RPC_MAINNET];

  let lastMessage = "Transaction not found on public Soroban RPC (wrong network, or older than the RPC history window).";

  for (const hash of hashes) {
    for (const rpc of rpcOrder) {
      try {
        const got = await rpcGetTransactionJson(rpc, hash);
        if (got.notFound) continue;
        if (got.failed) {
          return { error: "That transaction failed on-chain; use a successful deploy transaction or paste the contract URL/ID." };
        }
        if (!got.ok || !got.result) continue;
        const contractId = pickDeployedContractFromTxResult(got.result);
        if (contractId) return { contractId, resolvedFromTxHash: hash };
      } catch (e) {
        lastMessage = e.message || String(e);
      }
    }
  }
  return { error: lastMessage };
}

/**
 * Extract Soroban contract strkey from pasted text (URLs, numbered lists, multiple lines).
 * Prefers IDs from .../contract/C… paths (Lab, explorer) over incidental matches in tx pages.
 * @param {string} raw
 * @returns {string | null}
 */
export function extractContractId(raw) {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  const re = /C[A-Z2-7]{55}/g;
  const matches = [...text.matchAll(re)];
  if (!matches.length) return null;

  const ranked = matches.map((m) => {
    const id = m[0];
    const idx = m.index ?? 0;
    const ctx = text
      .slice(Math.max(0, idx - 80), Math.min(text.length, idx + id.length + 24))
      .toLowerCase();
    let score = 0;
    if (ctx.includes("/contract/")) score += 100;
    if (ctx.includes("lab.stellar.org")) score += 50;
    if (ctx.includes("stellar.expert") && ctx.includes("/contract/")) score += 40;
    if (ctx.includes("/tx/")) score -= 30;
    return { score, id };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0].id;
}

/**
 * Guess intended network from explorer / lab URLs for RPC order and hints.
 * @param {string} raw
 * @returns {"testnet" | "mainnet" | "unknown"}
 */
export function networkHintFromUrl(raw) {
  const s = (raw || "").toLowerCase();
  if (
    s.includes("/explorer/public/") ||
    s.includes("mainnet") ||
    s.includes("/network/public")
  ) {
    return "mainnet";
  }
  if (
    s.includes("/explorer/testnet/") ||
    s.includes("lab.stellar.org/r/testnet") ||
    s.includes("testnet") ||
    s.includes("futurenet") ||
    s.includes("soroban-testnet")
  ) {
    return "testnet";
  }
  return "unknown";
}

/**
 * Build Contract Code group checks for optional deployed link / ID (EC Level).
 * @param {string} raw — URL or raw contract ID; trimmed empty => optional warning only
 * @param {{ linkSource?: "panel" | "readme" | "none" }} [options] — where `raw` came from (for copy)
 * @returns {Promise<Array<{ id: string, label: string, status: string, message: string, required?: boolean, fix_hint?: string, evidence?: string }>>}
 */
export async function buildDeployedContractChecks(raw, options = {}) {
  const { linkSource = "none" } = options;
  const trimmed = (raw || "").trim();

  if (!trimmed) {
    return [
      {
        id: "contracts-deployed-link",
        label: "Deployed contract link",
        status: "warn",
        required: false,
        message:
          "No deployed contract / transaction link or ID found. Add it to README.md (submission template) or the optional field so reviewers can verify on-chain.",
        fix_hint:
          "In README.md, include a stellar.expert or Lab link to the contract (or a successful deploy tx) or the raw C… address. You can also paste the same into the field below.",
      },
    ];
  }

  const hint = networkHintFromUrl(trimmed);
  let extracted = extractContractId(trimmed);
  let resolvedFromTxHash = "";

  if (!extracted) {
    const txRes = await resolveContractFromTxUrls(trimmed, hint);
    if (txRes && "error" in txRes) {
      return [
        {
          id: "contracts-deployed-link-format",
          label: "Deployed contract link — format",
          status: "fail",
          required: true,
          message: txRes.error,
          fix_hint:
            "Paste a contract page URL, the raw C… contract ID, or a successful deploy transaction link (same network). Pure payment txs have no deploy contract.",
          evidence: trimmed.slice(0, 200),
        },
      ];
    }
    if (txRes?.contractId) {
      extracted = txRes.contractId;
      resolvedFromTxHash = txRes.resolvedFromTxHash;
    }
  }

  if (!extracted) {
    return [
      {
        id: "contracts-deployed-link-format",
        label: "Deployed contract link — format",
        status: "fail",
        required: true,
        message:
          "Could not find a Soroban contract ID (C…) or read one from a transaction link in the text checked.",
        fix_hint:
          linkSource === "readme"
            ? "Put a contract URL, deploy tx URL, or raw C… ID in README.md (for example in your deployed-contract section), or paste into the optional field below."
            : "Use a stellar.expert or Lab contract link, the raw contract ID, or a successful deploy transaction link.",
        evidence: trimmed.slice(0, 200),
      },
    ];
  }

  if (!StrKey.isValidContract(extracted)) {
    return [
      {
        id: "contracts-deployed-link-strkey",
        label: "Deployed contract link — contract ID",
        status: "fail",
        required: true,
        message: "The extracted value is not a valid Soroban contract strkey.",
        fix_hint: "Copy the contract ID exactly from the explorer or your wallet.",
        evidence: extracted,
      },
    ];
  }

  const txBit = resolvedFromTxHash
    ? ` Resolved from deploy transaction ${resolvedFromTxHash.slice(0, 10)}…`
    : "";
  const fromReadme =
    linkSource === "readme" ? " Link found in README.md." : linkSource === "panel" ? " Link from the optional field." : "";
  return [
    {
      id: "contracts-deployed-link-ok",
      label: "Deployed contract link",
      status: "pass",
      required: false,
      message: `A valid deployed contract address is present for submission.${fromReadme}${txBit} Reviewers can open it on stellar.expert or Stellar Lab.`,
      evidence: extracted,
    },
  ];
}

/**
 * Merge backend validation with client-side deploy checks and recompute top-level status.
 * @param {object} base — ValidateResponse from API
 * @param {object[]} extraChecks
 */
export function mergeValidationWithDeployChecks(base, extraChecks) {
  const checks = [...(base.checks || []), ...extraChecks];
  const invalid =
    base.status === "invalid" || checks.some((c) => c.required && c.status === "fail");
  return { ...base, checks, status: invalid ? "invalid" : "valid" };
}
