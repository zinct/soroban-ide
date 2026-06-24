/**
 * Utility for auto-appending deployment info to README.md after a successful
 * contract deploy. Keeps it idempotent — replaces any existing deploy section
 * with the latest deployment data.
 */

// ─── Tree search ──────────────────────────────────────────────────────────────

/**
 * Walk the file tree and return the node ID of the first README.md found
 * (case-insensitive). Shorter paths win so the root-level README is preferred
 * over nested ones (e.g. `contracts/counter/README.md`).
 *
 * @param {Array} treeData — nested tree nodes from the workspace
 * @returns {string|null} node ID or null if no README exists
 */
export function findReadmePath(treeData) {
  if (!treeData || !Array.isArray(treeData)) return null;

  const candidates = [];

  const walk = (nodes, depth) => {
    for (const node of nodes) {
      if (node.type === "file" && /^readme\.md$/i.test(node.name)) {
        candidates.push({ id: node.id, depth });
      }
      if (node.children?.length) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(treeData, 0);

  if (candidates.length === 0) return null;
  // Shallowest first (root README preferred)
  candidates.sort((a, b) => a.depth - b.depth);
  return candidates[0].id;
}

// ─── Section marker ───────────────────────────────────────────────────────────

const SECTION_HEADING = "## Deployed Contract";
// Regex that matches the entire deploy section (heading through end-of-file or
// next `## ` heading). Captures everything between the heading line and the
// next section boundary so we can replace it cleanly.
const SECTION_RE = /(?:^|\n)(## Deployed Contract\s*\n)([\s\S]*?)(?=\n## |\n*$)/;

// ─── Section builder ──────────────────────────────────────────────────────────

/**
 * Build the markdown table for a single deployment.
 *
 * @param {object} info
 * @param {string} info.contractId — C… contract strkey
 * @param {string} info.txHash     — 64-char hex transaction hash
 * @param {string} info.network    — e.g. "testnet"
 * @param {string} [info.wallet]   — wallet provider name (e.g. "freighter")
 * @param {string} [info.walletAddress] — deployer public key
 * @returns {string}
 */
function buildDeployTable(info) {
  const { contractId, txHash, network, wallet, walletAddress } = info;
  const net = (network || "testnet").toLowerCase();
  const explorerBase = net === "mainnet" || net === "public"
    ? "https://stellar.expert/explorer/public"
    : `https://stellar.expert/explorer/${net}`;

  const explorerContractUrl = `${explorerBase}/contract/${contractId}`;
  const explorerTxUrl = txHash ? `${explorerBase}/tx/${txHash}` : "";
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

  const rows = [
    `| Contract ID | \`${contractId}\` |`,
    `| Network | ${net} |`,
    `| Explorer | [View on stellar.expert](${explorerContractUrl}) |`,
  ];
  if (explorerTxUrl) {
    rows.push(`| Deploy Tx | [View transaction](${explorerTxUrl}) |`);
  }
  rows.push(`| Deployed | ${now} |`);
  if (wallet || walletAddress) {
    const walletLabel = wallet || "wallet";
    const addrSnippet = walletAddress
      ? ` (\`${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}\`)`
      : "";
    rows.push(`| Wallet | ${walletLabel}${addrSnippet} |`);
  }

  return [
    "| Field | Value |",
    "|-------|-------|",
    ...rows,
  ].join("\n");
}

// ─── Public: append / replace ─────────────────────────────────────────────────

/**
 * Return an updated README body with the deploy section replaced (or appended).
 * Idempotent — always produces exactly one `## Deployed Contract` section with
 * the latest deployment info.
 *
 * @param {string} existingContent — current README.md body
 * @param {object} deployInfo — same shape as `buildDeployTable` param
 * @returns {string} updated README body
 */
export function appendDeploymentToReadme(existingContent, deployInfo) {
  const table = buildDeployTable(deployInfo);
  const newSection = `${SECTION_HEADING}\n\n${table}\n`;

  if (!existingContent || typeof existingContent !== "string") {
    // No existing content — create minimal README with deploy section
    return `# Project\n\n${newSection}`;
  }

  const trimmed = existingContent.trimEnd();

  if (SECTION_RE.test(trimmed)) {
    // Replace existing deploy section
    return trimmed.replace(SECTION_RE, `\n${newSection}`) + "\n";
  }

  // Append at end
  return `${trimmed}\n\n${newSection}`;
}
