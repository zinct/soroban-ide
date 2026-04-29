// Deploy history: multi-contract, multi-deploy ledger persisted in localStorage.
//
// Each contract folder (e.g. "learning/hello-world") owns a bucket of
// deployment records, sorted newest-first. The most recent deployment in
// each bucket is the "active" one — the target for invoke/test actions.
// Older deploys are kept around as "previous" so the user can re-activate
// them or look up an old contract ID they forgot to copy.

const CAP_PER_CONTRACT = 10;
const UNKNOWN_PATH = "__unknown__";

// Keys align with existing naming conventions in DeployContext.
export const HISTORY_KEY = "soroban_deployment_history";

/** Load the history object. Always returns a plain object, never throws. */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist the full history object. Silently ignores quota errors. */
export function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history || {}));
  } catch {
    /* out of quota — drop silently */
  }
}

/**
 * Append a deployment record, demoting any previous "active" in the same
 * group and trimming the bucket to CAP_PER_CONTRACT. Pure function.
 */
export function addDeployment(history, record) {
  if (!record || !record.id) return history || {};
  const path = record.path || UNKNOWN_PATH;
  const prior = (history && history[path]) || [];
  // Drop an exact duplicate ID if it somehow already exists (re-render race).
  const withoutDupe = prior.filter((r) => r.id !== record.id);
  // Demote all previous entries; the new one becomes the active head.
  const demoted = withoutDupe.map((r) => ({ ...r, status: "previous" }));
  const next = [
    { ...record, path, status: "active", deployedAt: record.deployedAt || Date.now() },
    ...demoted,
  ].slice(0, CAP_PER_CONTRACT);
  return { ...(history || {}), [path]: next };
}

/** Remove a single deployment by (path, id). */
export function removeDeployment(history, path, id) {
  if (!history || !history[path]) return history || {};
  const filtered = history[path].filter((r) => r.id !== id);
  // If the removed entry was the active one, promote the newest survivor.
  const promoted = filtered.length > 0 && !filtered.some((r) => r.status === "active")
    ? filtered.map((r, idx) => (idx === 0 ? { ...r, status: "active" } : { ...r, status: "previous" }))
    : filtered;
  const next = { ...history };
  if (promoted.length === 0) {
    delete next[path];
  } else {
    next[path] = promoted;
  }
  return next;
}

/** Clear every bucket for a single contract path. */
export function clearGroup(history, path) {
  if (!history || !history[path]) return history || {};
  const next = { ...history };
  delete next[path];
  return next;
}

/** Wipe the entire history. */
export function clearAll() {
  return {};
}

/**
 * Make a previously-deployed record the active one within its group. Useful
 * when the user wants to invoke an older version without redeploying.
 */
export function promoteToActive(history, path, id) {
  if (!history || !history[path]) return history || {};
  const list = history[path];
  if (!list.some((r) => r.id === id)) return history;
  const reordered = [
    ...list.filter((r) => r.id === id).map((r) => ({ ...r, status: "active" })),
    ...list.filter((r) => r.id !== id).map((r) => ({ ...r, status: "previous" })),
  ];
  return { ...history, [path]: reordered };
}

/** Toggle "pinned" status for a single deployment record. */
export function togglePinned(history, path, id) {
  if (!history || !history[path]) return history || {};
  const nextList = history[path].map((r) => (
    r.id === id ? { ...r, pinned: !r.pinned } : r
  ));
  return { ...history, [path]: nextList };
}

/**
 * Turn the bucket object into a stable array of groups, sorted by most
 * recent deployment across the group (so whichever contract the user just
 * touched bubbles to the top).
 */
export function listGroups(history) {
  if (!history) return [];
  return Object.entries(history)
    .map(([path, deployments]) => ({
      path,
      deployments: [...deployments].sort((a, b) => {
        // active first, then newest deployedAt
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return (b.deployedAt || 0) - (a.deployedAt || 0);
      }),
      latestAt: Math.max(...deployments.map((d) => d.deployedAt || 0), 0),
    }))
    .sort((a, b) => b.latestAt - a.latestAt);
}

/** Human-readable relative time. Falls back to a locale date after a week. */
export function formatRelativeTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 2) return "1 min ago";
  if (m < 45) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 2) return "1 hr ago";
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 2) return "yesterday";
  if (d < 7) return `${d} days ago`;
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Build a stellar.expert explorer URL for a contract on a given network. */
export function explorerUrl(id, network) {
  if (!id) return "#";
  const net = (network || "testnet").toLowerCase();
  if (net === "mainnet" || net === "public") {
    return `https://stellar.expert/explorer/public/contract/${id}`;
  }
  // testnet, futurenet → stellar.expert supports both via the network slug
  return `https://stellar.expert/explorer/${net}/contract/${id}`;
}

/** Short-form display of a contract ID. */
export function shortId(id) {
  if (!id || id.length < 16) return id || "";
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}
