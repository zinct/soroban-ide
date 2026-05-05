import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Wallet, Hammer, Rocket, CheckCircle, AlertCircle, Loader, Copy, Check, Play, ChevronDown, ChevronRight, Folder, RefreshCw, ExternalLink, Trash2, ArrowUpCircle, Star, Search } from "lucide-react";
import { useDeploy } from "../../context/DeployContext";
import { useContract } from "../../context/ContractContext";
import {
  initDefaultWallet,
  getDefaultWalletStatus,
  getContractInterface,
  submitCommand,
  connectBuildStream,
  collectProjectFiles,
  getSessionId,
} from "../../services/backendService";
import { signAndSubmitWithSigner } from "../../services/freighter";
import { signWithWallet } from "../../services/walletManager";
import {
  findContracts,
  groupContracts,
  resolveWasmPath,
  manifestPathFlag,
} from "./contractDiscovery";
import {
  listGroups,
  formatRelativeTime,
  explorerUrl,
  shortId,
} from "./deploymentHistory";

const CONTRACT_STORAGE_KEY = "soroban:selectedContract";
const DEPLOY_PRESETS_KEY = "soroban:deploy_presets";
const INVOKE_CASES_KEY = "soroban:invoke_test_cases";

// Coerce arbitrary error values into a printable string. Catches the
// `[object Object]` regression that appears when a thrown value isn't an
// Error (e.g. Freighter returning a plain `{ code, message }` object).
const errString = (e) => {
  if (e == null) return "";
  if (typeof e === "string") return e;
  if (e?.message) return String(e.message);
  try { return JSON.stringify(e); } catch { return String(e); }
};
// Currently all deploys go to testnet (see the `--network testnet` flag
// below). The history data model carries `network` per-record so the UI
// can distinguish once multi-network deploys are enabled.
const DEFAULT_NETWORK = "testnet";
const DEFAULT_SALT_MODE = "random";

const randomSaltHex = () => (
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
);

const loadDeployPresets = () => {
  try {
    const raw = localStorage.getItem(DEPLOY_PRESETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveDeployPresets = (data) => {
  try { localStorage.setItem(DEPLOY_PRESETS_KEY, JSON.stringify(data || {})); } catch {}
};

const loadInvokeCases = () => {
  try {
    const raw = localStorage.getItem(INVOKE_CASES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveInvokeCases = (data) => {
  try { localStorage.setItem(INVOKE_CASES_KEY, JSON.stringify(data || {})); } catch {}
};

// Dispatch a command to the Terminal panel
const runInTerminal = (cmd, files, onDone, onContractId) => {
  // Show command in terminal
  window.dispatchEvent(new CustomEvent("soroban:runCommand", { detail: { cmd, files, onDone, onContractId } }));
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    running: { icon: <Loader size={11} className="spin" />, label: "Running",  cls: "badge-running" },
    success: { icon: <CheckCircle size={11} />,             label: "Success",  cls: "badge-success" },
    error:   { icon: <AlertCircle size={11} />,             label: "Failed",   cls: "badge-error"   },
  };
  const s = map[status];
  if (!s) return null;
  return <span className={`deploy-badge ${s.cls}`}>{s.icon}{s.label}</span>;
};

const Section = ({ icon, title, children, defaultOpen = false, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="deploy-section">
      <button className="deploy-section-header" onClick={() => setOpen(v => !v)}>
        {icon}<span>{title}</span>
        {badge && <span style={{ marginLeft: 8 }}>{badge}</span>}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <div className={`deploy-section-content ${open ? "open" : ""}`}>
        <div className="deploy-section-body">{children}</div>
      </div>
    </div>
  );
};

const DeployPanel = ({ treeData, fileContents }) => {
  const {
    defaultWallet, setDefaultWallet, walletLoading, setWalletLoading,
    compileStatus, setCompileStatus,
    deployStatus, setDeployStatus,
    deploymentHistory, addDeployment, removeDeployment, clearGroup, clearAllHistory, promoteToActive, togglePinned,
  } = useDeploy();
  const {
    walletAddress,
    walletNetwork,
    walletNetworkPassphrase,
    walletProviderId,
    setWalletProviderId,
    walletClient,
    walletProviders,
    connectWallet,
    disconnectWallet,
    error: walletConnectError,
  } = useContract();

  const [walletError, setWalletError] = useState(null);
  const [freighterBalance, setFreighterBalance] = useState(null);
  const [alias, setAlias] = useState("my-contract");
  const [sourceAccount, setSourceAccount] = useState("default");
  const [deployNetwork, setDeployNetwork] = useState(DEFAULT_NETWORK);
  const [saltMode, setSaltMode] = useState(DEFAULT_SALT_MODE); // random | manual
  const [manualSalt, setManualSalt] = useState("");
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetsByPath, setPresetsByPath] = useState(() => loadDeployPresets());
  const [invokeCasesByPath, setInvokeCasesByPath] = useState(() => loadInvokeCases());
  const [copiedId, setCopiedId] = useState(null);
  const [copiedDefault, setCopiedDefault] = useState(false);
  const [copiedFreighter, setCopiedFreighter] = useState(false);
  // Invoke state is scoped by contract ID so each deployed contract has
  // its own independent test surface — essential once multiple contracts
  // show up in the Deployed Contracts list at the same time.
  const [invokeResults, setInvokeResults] = useState({}); // { [contractId]: { [fnName]: result } }
  const [invokingFn, setInvokingFn] = useState({});       // { [contractId]: fnName | null }
  const [fnArgs, setFnArgs] = useState({});               // { [contractId]: { [fnName]: { [paramName]: value } } }
  const [expandedTest, setExpandedTest] = useState(() => new Set()); // Set<contractId>
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  // Force a re-render every 30s so relative timestamps stay fresh without
  // a per-row clock component. Cheap and good enough.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ─── Contract selector ───────────────────────────────────────────────────
  // Scan the file tree for every folder that owns a Cargo.toml. The user
  // picks which one the Compile/Deploy actions target.
  const [rescanNonce, setRescanNonce] = useState(0);
  const contracts = useMemo(
    () => findContracts(treeData, fileContents),
    // `rescanNonce` lets the user force a re-scan via the refresh button.
    [treeData, fileContents, rescanNonce],
  );
  const groupedContracts = useMemo(() => groupContracts(contracts), [contracts]);

  const [selectedPath, setSelectedPath] = useState(() => {
    try { return localStorage.getItem(CONTRACT_STORAGE_KEY) || ""; }
    catch { return ""; }
  });

  // Resolve the selected contract record from `contracts`. Fall back to the
  // first available entry when the persisted path no longer matches (folder
  // renamed, deleted, or workspace changed).
  const selectedContract = useMemo(() => {
    if (contracts.length === 0) return null;
    return contracts.find((c) => c.path === selectedPath) || contracts[0];
  }, [contracts, selectedPath]);

  const deployPresets = useMemo(() => {
    if (!selectedContract?.path) return [];
    return [...(presetsByPath[selectedContract.path] || [])]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [presetsByPath, selectedContract]);

  // Persist the resolved selection so the fallback sticks across reloads.
  useEffect(() => {
    if (!selectedContract) {
      try { localStorage.removeItem(CONTRACT_STORAGE_KEY); } catch {}
      return;
    }
    if (selectedContract.path !== selectedPath) {
      setSelectedPath(selectedContract.path);
    }
    try { localStorage.setItem(CONTRACT_STORAGE_KEY, selectedContract.path); } catch {}
  }, [selectedContract, selectedPath]);

  useEffect(() => {
    saveDeployPresets(presetsByPath);
  }, [presetsByPath]);

  useEffect(() => {
    saveInvokeCases(invokeCasesByPath);
  }, [invokeCasesByPath]);

  useEffect(() => {
    setSelectedPresetId("");
    setPresetName("");
  }, [selectedContract?.path]);

  useEffect(() => {
    getDefaultWalletStatus().then(setDefaultWallet).catch(() => {});
  }, []);

  useEffect(() => {
    if (!walletAddress) { setFreighterBalance(null); return; }
    fetch(`https://horizon-testnet.stellar.org/accounts/${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const native = data?.balances?.find(b => b.asset_type === "native");
        if (native) setFreighterBalance(parseFloat(native.balance).toFixed(2));
      })
      .catch(() => {});
  }, [walletAddress]);

  // Auto-suggest the alias from the selected contract's folder name. The
  // user's manual edits take priority and also "lock" the field so switching
  // contracts doesn't clobber their input.
  const aliasEditedRef = useRef(false);
  const lastAutoAliasRef = useRef("my-contract");
  useEffect(() => {
    if (!selectedContract) return;
    const suggested = selectedContract.name;
    if (!suggested) return;
    // Overwrite the alias only if the user hasn't typed, or if the current
    // value still matches the previous auto-suggestion.
    if (!aliasEditedRef.current || alias === lastAutoAliasRef.current) {
      setAlias(suggested);
      lastAutoAliasRef.current = suggested;
      aliasEditedRef.current = false;
    }
  }, [selectedContract]);

  const handleSelectContract = useCallback((nextPath) => {
    setSelectedPath(nextPath);
  }, []);

  const handleRescanContracts = useCallback(() => {
    setRescanNonce((n) => n + 1);
  }, []);

  // ─── Derived deploy history ──────────────────────────────────────────────

  const groups = useMemo(() => listGroups(deploymentHistory), [deploymentHistory]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyWalletFilter, setHistoryWalletFilter] = useState("all");
  const [historyNetworkFilter, setHistoryNetworkFilter] = useState("all");
  const [historyContractFilter, setHistoryContractFilter] = useState("all");
  const [diffPair, setDiffPair] = useState(null); // { newer, older }

  const historyFilterOptions = useMemo(() => {
    const wallets = new Set();
    const networks = new Set();
    groups.forEach((g) => {
      g.deployments.forEach((d) => {
        if (d.wallet) wallets.add(d.wallet);
        if (d.network) networks.add((d.network || "").toLowerCase());
      });
    });
    return {
      wallets: [...wallets].sort(),
      networks: [...networks].sort(),
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return groups
      .filter((g) => historyContractFilter === "all" || g.path === historyContractFilter)
      .map((g) => {
        const deployments = g.deployments
          .filter((d) => {
            if (historyWalletFilter !== "all" && (d.wallet || "") !== historyWalletFilter) return false;
            if (historyNetworkFilter !== "all" && (d.network || "").toLowerCase() !== historyNetworkFilter) return false;
            if (!q) return true;
            const hay = [
              d.id,
              d.alias,
              d.crateName,
              d.path,
              d.wallet,
              d.walletAddress,
              d.network,
            ].filter(Boolean).join(" ").toLowerCase();
            return hay.includes(q);
          })
          .sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            if (a.status === "active" && b.status !== "active") return -1;
            if (a.status !== "active" && b.status === "active") return 1;
            return (b.deployedAt || 0) - (a.deployedAt || 0);
          });
        return { ...g, deployments };
      })
      .filter((g) => g.deployments.length > 0);
  }, [groups, historyContractFilter, historyWalletFilter, historyNetworkFilter, historyQuery]);

  // Active deployment for the currently-selected contract (used by the
  // "replace?" confirm dialog and the Deploy button's "redeploy" state).
  const activeForSelected = useMemo(() => {
    if (!selectedContract) return null;
    const bucket = deploymentHistory?.[selectedContract.path];
    if (!bucket || bucket.length === 0) return null;
    return bucket.find((r) => r.status === "active") || bucket[0];
  }, [deploymentHistory, selectedContract]);

  // Reset compile/deploy status when the selected contract path changes
  // (e.g. after a rename). The compiled .wasm artifact is derived from
  // the contract location, so a stale build/deploy status can mismatch.
  const prevContractPathRef = useRef(selectedContract?.path || "");
  useEffect(() => {
    const current = selectedContract?.path || "";
    if (prevContractPathRef.current && current && current !== prevContractPathRef.current) {
      setCompileStatus(null);
      setDeployStatus(null);
    }
    prevContractPathRef.current = current;
  }, [selectedContract?.path]);

  // ─── Wallet ───────────────────────────────────────────────────────────────

  const handleInitWallet = useCallback(async () => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const status = await initDefaultWallet();
      setDefaultWallet(status);
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  // ─── Compile → stream to Terminal ────────────────────────────────────────

  const handleCompile = useCallback(async () => {
    if (!selectedContract) return;
    setCompileStatus("running");
    window.dispatchEvent(new Event("soroban:terminalBusy"));
    const files = collectProjectFiles(treeData, fileContents);
    const cmd = `stellar contract build${manifestPathFlag(selectedContract)}`;
    try {
      const { sessionId, jobId } = await submitCommand(files, cmd);
      // Show in terminal
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "command", content: cmd, cwd: "~/project" }
      }));
      const cleanup = connectBuildStream(sessionId, jobId, {
        onMessage: (msg) => {
          window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
            detail: { type: msg.type === "error" ? "error" : "output", content: msg.content }
          }));
        },
        onError: () => { setCompileStatus("error"); window.dispatchEvent(new Event("soroban:terminalIdle")); cleanup?.(); },
        onDone: async () => {
          setCompileStatus("success");
          window.dispatchEvent(new Event("soroban:terminalIdle"));
          cleanup();
        },
        onClose: () => {},
      });
    } catch (err) {
      setCompileStatus("error");
      window.dispatchEvent(new Event("soroban:terminalIdle"));
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "error", content: err.message }
      }));
    }
  }, [treeData, fileContents, selectedContract]);

  // ─── Deploy → stream to Terminal ─────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (compileStatus !== "success") return;
    // Only warn if the *currently selected* contract already has an active
    // deployment. Deploying a different contract for the first time should
    // be a no-prompt path — it just adds a new group to the history.
    if (activeForSelected) {
      setShowReplaceDialog(true);
      return;
    }
    await executeDeploy();
  }, [compileStatus, activeForSelected]);

  const executeDeploy = useCallback(async () => {
    if (!selectedContract) return;
    setDeployStatus("running");
    window.dispatchEvent(new Event("soroban:terminalBusy"));
    const files = collectProjectFiles(treeData, fileContents);
    const wasmPath = resolveWasmPath(selectedContract, fileContents);
    if (!wasmPath) {
      setDeployStatus("error");
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "error", content: "Could not resolve the compiled .wasm path for the selected contract. Build it first." }
      }));
      return;
    }
    const useWallet = sourceAccount === "wallet" && walletAddress;
    // For Freighter deploys we pass the live public key directly instead of a
    // backend identity alias. The alias can get stale if the extension account
    // changes, which leads to source/sequence mismatches (txBadSeq).
    const sourceKey = useWallet ? walletAddress : (defaultWallet?.name || "stellar-ide-default");
    const buildOnly = useWallet ? " --build-only" : "";
    const salt = saltMode === "manual" ? manualSalt.trim().toLowerCase() : randomSaltHex();
    if (!/^[0-9a-f]{64}$/.test(salt)) {
      setDeployStatus("error");
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "error", content: "Invalid salt: provide exactly 64 hex chars (0-9, a-f)." }
      }));
      return;
    }
    // Prefix alias with short session ID to avoid collisions between users on shared server key
    const sessionPrefix = getSessionId().slice(0, 8);
    const scopedAlias = `${sessionPrefix}-${alias}`;
    const cmd = `stellar contract deploy --wasm ${wasmPath} --source ${sourceKey} --network ${deployNetwork} --alias ${scopedAlias} --salt ${salt}${buildOnly}`;

    // Snapshot metadata that will be attached to the history record once
    // the contract ID arrives. Captured here so the async handlers below
    // always see the values that were current when the user hit Deploy.
    const deployMeta = {
      path: selectedContract.path,
      crateName: selectedContract.crateName || selectedContract.name,
      alias,
      scopedAlias,
      network: deployNetwork,
      wallet: useWallet ? (walletProviderId || "wallet") : (defaultWallet?.name || "stellar-ide-default"),
      walletAddress: useWallet ? walletAddress : (defaultWallet?.address || null),
    };

    // Record a new deployment in the history. Fetches the contract
    // interface so the invoke/test UI can render immediately without an
    // extra click. Failures to fetch the interface are non-fatal — the
    // record still lands with an empty function list.
    const recordDeploy = async (contractId) => {
      let functions = [];
      try {
        // Scope interface parsing to the just-deployed crate. Without this
        // the backend aggregates every lib.rs in the workspace and the
        // user ends up with invoke buttons for functions that don't exist
        // on this contract (e.g. "unrecognized subcommand 'get_count'").
        const result = await getContractInterface(files, deployMeta.path);
        const raw = result?.functions || [];
        // Defensive dedupe by name in case the backend ever returns dupes.
        const seen = new Set();
        functions = raw.filter((fn) => {
          if (!fn?.name || seen.has(fn.name)) return false;
          seen.add(fn.name);
          return true;
        });
      } catch (_) { /* non-fatal */ }
      addDeployment({
        id: contractId,
        ...deployMeta,
        deployedAt: Date.now(),
        functions,
      });
      // Auto-expand the newly-deployed contract's Test section so the user
      // sees the invoke UI right away. This matches "I just deployed it,
      // now let me test it" as a natural next step.
      setExpandedTest((prev) => {
        const next = new Set(prev);
        next.add(contractId);
        return next;
      });
    };

    try {
      const { sessionId, jobId } = await submitCommand(files, cmd);
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "command", content: cmd, cwd: "~/project" }
      }));
      let fullLog = "";
      const cleanup = connectBuildStream(sessionId, jobId, {
        onMessage: (msg) => {
          fullLog += (msg.content || "") + "\n";
          window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
            detail: { type: msg.type === "error" ? "error" : "output", content: msg.content }
          }));
        },
        onError: () => { setDeployStatus("error"); window.dispatchEvent(new Event("soroban:terminalIdle")); cleanup?.(); },
        onDone: async () => {
          window.dispatchEvent(new Event("soroban:terminalIdle"));
          if (useWallet) {
            // Extract XDR: stellar --build-only prints the assembled XDR as the last
            // stdout line. It's a base64 string (only A-Z, a-z, 0-9, +, /, =).
            const xdrLineRe = /^[A-Za-z0-9+/]+=*$/;
            const xdr = fullLog.trim().split("\n")
              .map(l => l.trim())
              .filter(l => xdrLineRe.test(l))
              .pop();
            if (!xdr) { setDeployStatus("error"); cleanup(); return; }
            try {
              window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                detail: { type: "output", content: "🔐 Signing with Freighter…" }
              }));
              const result = await signAndSubmitWithSigner(
                xdr,
                walletAddress,
                (xdrToSign, address) =>
                  signWithWallet(xdrToSign, {
                    providerId: walletProviderId,
                    address,
                    networkPassphrase: walletNetworkPassphrase,
                    client: walletClient,
                  }),
              );
              window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                detail: { type: "output", content: `✅ Transaction submitted via ${walletProviderId || "wallet"}!` }
              }));
              if (result?.contractId) {
                await recordDeploy(result.contractId);
                window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                  detail: { type: "output", content: `📋 Contract ID: ${result.contractId}` }
                }));
              }
              setDeployStatus("success");
            } catch (err) {
              // Use the stage tag set by signAndSubmitWithFreighter so the
              // user sees what actually failed (sign popup vs RPC submit
              // vs on-chain). The message itself already includes the
              // decoded txResultCode where applicable.
              const label =
                err.stage === "submit"  ? "❌ Submit failed:"   :
                err.stage === "onchain" ? "❌ On-chain failed:" :
                err.stage === "sign"    ? "❌ Sign failed:"     :
                                          "❌ Deploy failed:";
              window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                detail: { type: "error", content: `${label} ${err.message}` }
              }));
              setDeployStatus("error");
            }
          } else {
            const match = fullLog.match(/C[A-Z2-7]{55}/);
            if (match) await recordDeploy(match[0]);
            setDeployStatus("success");
          }
          cleanup();
        },
        onClose: () => {},
      });
    } catch (err) {
      setDeployStatus("error");
      window.dispatchEvent(new Event("soroban:terminalIdle"));
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "error", content: err.message }
      }));
    }
  }, [treeData, fileContents, alias, sourceAccount, walletAddress, walletProviderId, walletNetworkPassphrase, walletClient, defaultWallet, selectedContract, addDeployment, deployNetwork, saltMode, manualSalt]);

  // ─── Invoke → stream to Terminal (scoped per contract) ───────────────────

  const handleInvoke = useCallback(async (deployment, fn) => {
    if (!deployment?.id) return;
    const contractId = deployment.id;
    setInvokingFn((prev) => ({ ...prev, [contractId]: fn.name }));
    const args = (fnArgs[contractId]?.[fn.name]) || {};
    const params = fn.params || [];
    const argStr = params.map(p => {
      const val = args[p.name] ?? "";
      const quoted = val.includes(" ") ? `"${val}"` : (val || '""');
      return `--${p.name} ${quoted}`;
    }).join(" ");
    const sendFlag = fn.category === "write" ? " --send=yes" : "";
    const sourceKey = deployment.wallet && deployment.wallet !== "freighter"
      ? deployment.wallet
      : (defaultWallet?.name || "stellar-ide-default");
    const network = deployment.network || DEFAULT_NETWORK;
    const cmd = `stellar contract invoke --id ${contractId} --source ${sourceKey} --network ${network}${sendFlag} -- ${fn.name} ${argStr}`.trim();
    const files = collectProjectFiles(treeData, fileContents);
    try {
      const { sessionId, jobId } = await submitCommand(files, cmd);
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "command", content: cmd, cwd: "~/project" }
      }));
      let out = "";
      const cleanup = connectBuildStream(sessionId, jobId, {
        onMessage: (msg) => {
          out += (msg.content || "") + "\n";
          window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
            detail: { type: msg.type === "error" ? "error" : "output", content: msg.content }
          }));
        },
        onError: () => {
          setInvokeResults((r) => ({
            ...r,
            [contractId]: { ...(r[contractId] || {}), [fn.name]: { error: "Failed" } },
          }));
          setInvokingFn((prev) => ({ ...prev, [contractId]: null }));
          cleanup?.();
        },
        onDone: () => {
          const failed = out.includes("error:") || out.includes("Command failed");
          setInvokeResults((r) => ({
            ...r,
            [contractId]: {
              ...(r[contractId] || {}),
              [fn.name]: failed ? { error: out.trim() } : { output: out.trim() },
            },
          }));
          setInvokingFn((prev) => ({ ...prev, [contractId]: null }));
          cleanup();
        },
        onClose: () => {},
      });
    } catch (err) {
      setInvokeResults((r) => ({
        ...r,
        [contractId]: { ...(r[contractId] || {}), [fn.name]: { error: err.message } },
      }));
      setInvokingFn((prev) => ({ ...prev, [contractId]: null }));
    }
  }, [fnArgs, treeData, fileContents, defaultWallet]);

  const setFnArgForContract = useCallback((contractId, fnName, paramName, value) => {
    setFnArgs((prev) => ({
      ...prev,
      [contractId]: {
        ...(prev[contractId] || {}),
        [fnName]: {
          ...((prev[contractId] || {})[fnName] || {}),
          [paramName]: value,
        },
      },
    }));
  }, []);

  const caseKey = useCallback((path, fnName) => `${path || "__unknown__"}::${fnName}`, []);

  const savedCasesFor = useCallback((deployment, fnName) => {
    const key = caseKey(deployment?.path, fnName);
    return invokeCasesByPath[key] || [];
  }, [invokeCasesByPath, caseKey]);

  const saveCurrentArgsAsCase = useCallback((deployment, fn) => {
    if (!deployment?.path || !fn?.name) return;
    const key = caseKey(deployment.path, fn.name);
    const args = fnArgs[deployment.id]?.[fn.name] || {};
    const label = typeof window !== "undefined"
      ? window.prompt("Test case name", `case-${new Date().toLocaleTimeString()}`)
      : "";
    if (!label || !label.trim()) return;
    const nextCase = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      label: label.trim(),
      args,
      updatedAt: Date.now(),
    };
    setInvokeCasesByPath((prev) => {
      const prior = prev[key] || [];
      return { ...prev, [key]: [nextCase, ...prior].slice(0, 20) };
    });
  }, [fnArgs, caseKey]);

  const applySavedCase = useCallback((deployment, fnName, caseId) => {
    const key = caseKey(deployment?.path, fnName);
    const item = (invokeCasesByPath[key] || []).find((c) => c.id === caseId);
    if (!item) return;
    setFnArgs((prev) => ({
      ...prev,
      [deployment.id]: {
        ...(prev[deployment.id] || {}),
        [fnName]: { ...(item.args || {}) },
      },
    }));
  }, [invokeCasesByPath, caseKey]);

  const deleteSavedCase = useCallback((deployment, fnName, caseId) => {
    const key = caseKey(deployment?.path, fnName);
    setInvokeCasesByPath((prev) => {
      const nextList = (prev[key] || []).filter((c) => c.id !== caseId);
      const next = { ...prev };
      if (nextList.length === 0) delete next[key];
      else next[key] = nextList;
      return next;
    });
  }, [caseKey]);

  const toggleTestExpanded = useCallback((contractId) => {
    setExpandedTest((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  }, []);

  const handleCopyId = useCallback((id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
  }, []);

  const handleRemoveDeployment = useCallback((path, id) => {
    removeDeployment(path, id);
  }, [removeDeployment]);

  const handleClearGroup = useCallback((path) => {
    if (typeof window !== "undefined" && !window.confirm("Remove all deployments for this contract?")) return;
    clearGroup(path);
  }, [clearGroup]);

  const handleClearAll = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("Clear the entire deploy history?")) return;
    clearAllHistory();
  }, [clearAllHistory]);

  const handleSavePreset = useCallback(() => {
    if (!selectedContract?.path) return;
    const name = presetName.trim();
    if (!name) return;
    const nextPreset = {
      id: selectedPresetId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name,
      alias: alias.trim(),
      sourceAccount,
      network: deployNetwork,
      saltMode,
      manualSalt: saltMode === "manual" ? manualSalt.trim().toLowerCase() : "",
      updatedAt: Date.now(),
    };
    setPresetsByPath((prev) => {
      const path = selectedContract.path;
      const list = prev[path] || [];
      const withoutSameId = list.filter((p) => p.id !== nextPreset.id);
      return { ...prev, [path]: [nextPreset, ...withoutSameId].slice(0, 20) };
    });
    setSelectedPresetId(nextPreset.id);
  }, [selectedContract, presetName, selectedPresetId, alias, sourceAccount, deployNetwork, saltMode, manualSalt]);

  const handleLoadPreset = useCallback((id) => {
    if (!selectedContract?.path) return;
    const preset = (presetsByPath[selectedContract.path] || []).find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setPresetName(preset.name || "");
    setAlias(preset.alias || selectedContract.name || "my-contract");
    aliasEditedRef.current = true;
    setSourceAccount((preset.sourceAccount === "freighter" ? "wallet" : preset.sourceAccount) || "default");
    setDeployNetwork(preset.network || DEFAULT_NETWORK);
    const mode = preset.saltMode || DEFAULT_SALT_MODE;
    setSaltMode(mode);
    setManualSalt(mode === "manual" ? (preset.manualSalt || "") : "");
  }, [selectedContract, presetsByPath]);

  const handleDeletePreset = useCallback(() => {
    if (!selectedContract?.path || !selectedPresetId) return;
    setPresetsByPath((prev) => {
      const path = selectedContract.path;
      const list = (prev[path] || []).filter((p) => p.id !== selectedPresetId);
      const next = { ...prev };
      if (list.length === 0) delete next[path];
      else next[path] = list;
      return next;
    });
    setSelectedPresetId("");
    setPresetName("");
  }, [selectedContract, selectedPresetId]);

  const handleTogglePinned = useCallback((path, id) => {
    togglePinned(path, id);
  }, [togglePinned]);

  return (
    <div className="deploy-panel">
      {showReplaceDialog && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,padding:"28px 28px 24px",maxWidth:420,width:"90%"}}>
            <div style={{fontWeight:600,fontSize:15,color:"#fff",marginBottom:12,fontFamily:"monospace"}}>Redeploy {selectedContract?.name}?</div>
            <div style={{color:"#999",fontSize:13,lineHeight:1.7,marginBottom:20,fontFamily:"monospace"}}>
              The current active deployment will move to the Previous list. The new one becomes active.
              {activeForSelected?.id && (
                <>
                  <br/><br/>
                  <span style={{color:"#fff",fontSize:11,wordBreak:"break-all"}}>{activeForSelected.id}</span>
                </>
              )}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={() => setShowReplaceDialog(false)} style={{padding:"8px 18px",fontSize:13,borderRadius:6,border:"1px solid #333",background:"transparent",color:"#ccc",cursor:"pointer",fontFamily:"monospace"}}>Cancel</button>
              <button onClick={() => { setShowReplaceDialog(false); executeDeploy(); }} style={{padding:"8px 18px",fontSize:13,borderRadius:6,border:"none",background:"#fff",color:"#000",cursor:"pointer",fontWeight:600,fontFamily:"monospace"}}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Wallet ── */}
      <Section icon={<Wallet size={14} />} title="Wallet">
        <div className="deploy-subsection">
          <div className="deploy-subsection-label">Default Testnet Account</div>
          {defaultWallet?.exists ? (
            <div className="deploy-wallet-card">
              <div className="deploy-wallet-card-name">
                <span>{defaultWallet.name}</span>
                <span className={`deploy-wallet-funded ${defaultWallet.funded ? "funded" : "unfunded"}`}>
                  {defaultWallet.funded ? "Funded" : "Not Funded"}
                </span>
              </div>
              <div className="deploy-wallet-card-addr">
                <span>{defaultWallet.address ? `${defaultWallet.address.slice(0,6)}…${defaultWallet.address.slice(-4)}` : ""}</span>
                <button className="deploy-icon-btn" onClick={() => { navigator.clipboard.writeText(defaultWallet.address); setCopiedDefault(true); setTimeout(() => setCopiedDefault(false), 2000); }}>{copiedDefault ? <Check size={11} /> : <Copy size={11} />}</button>
              </div>
              {defaultWallet.balance && (
                <div className="deploy-wallet-card-balance">
                  <span className="deploy-balance-amount">{parseFloat(defaultWallet.balance).toFixed(2)}</span>
                  <span className="deploy-balance-unit">XLM</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="deploy-hint">No default account yet.</p>
              <button className="deploy-btn deploy-btn-primary" onClick={handleInitWallet} disabled={walletLoading}>
                {walletLoading ? <Loader size={12} className="spin" /> : <Wallet size={12} />}
                {walletLoading ? "Creating..." : "Create & Fund Account"}
              </button>
            </>
          )}
          {walletError && <div className="deploy-error">{errString(walletError)}</div>}
        </div>

        <div className="deploy-subsection">
          <div className="deploy-subsection-label">External Wallet</div>
          <select
            className="deploy-input"
            value={walletProviderId}
            onChange={(e) => setWalletProviderId(e.target.value)}
            disabled={!!walletAddress}
            style={{ marginBottom: 8 }}
          >
            {walletProviders.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          {walletAddress ? (
            <div className="deploy-wallet-card">
              <div className="deploy-wallet-card-name">
                <span>{walletProviders.find((w) => w.id === walletProviderId)?.label || walletProviderId}</span>
                {walletNetwork && (
                  <span className={`deploy-wallet-funded ${walletNetwork.toLowerCase().includes("test") ? "funded" : "unfunded"}`}>
                    {walletNetwork}
                  </span>
                )}
                <button className="deploy-icon-btn" onClick={disconnectWallet} title="Disconnect" style={{marginLeft:"auto"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
              <div className="deploy-wallet-card-addr">
                <span>{`${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`}</span>
                <button className="deploy-icon-btn" onClick={() => { navigator.clipboard.writeText(walletAddress); setCopiedFreighter(true); setTimeout(() => setCopiedFreighter(false), 2000); }}>{copiedFreighter ? <Check size={11} /> : <Copy size={11} />}</button>
              </div>
              {freighterBalance && (
                <div className="deploy-wallet-card-balance">
                  <span className="deploy-balance-amount">{freighterBalance}</span>
                  <span className="deploy-balance-unit">XLM</span>
                </div>
              )}
              {walletConnectError && <div className="deploy-error">{errString(walletConnectError)}</div>}
            </div>
          ) : (
            <>
              <button className="deploy-btn deploy-btn-secondary" onClick={() => connectWallet(walletProviderId)}>
                Connect {walletProviders.find((w) => w.id === walletProviderId)?.label || "Wallet"}
              </button>
              <div className="deploy-hint" style={{marginTop:4}}>
                ⚠️ Before connecting, switch wallet network to <strong>Testnet</strong>.
              </div>
            </>
          )}
        </div>
      </Section>

      {/* ── Compile ── */}
      <Section icon={<Hammer size={14} />} title="Compile" badge={<StatusBadge status={compileStatus} />}>
        <div className="deploy-form-group">
          <div className="deploy-label-row">
            <label className="deploy-label">Contract</label>
            {contracts.length > 0 && (
              <button
                type="button"
                className="deploy-icon-btn"
                onClick={handleRescanContracts}
                title="Re-scan workspace for Cargo.toml"
                disabled={compileStatus === "running" || deployStatus === "running"}
              >
                <RefreshCw size={11} />
              </button>
            )}
          </div>

          {contracts.length === 0 ? (
            <div className="deploy-contract-empty">
              No <code>Cargo.toml</code> found in this workspace.
            </div>
          ) : contracts.length === 1 ? (
            <div className="deploy-contract-pill" title={contracts[0].path || "(workspace root)"}>
              <Folder size={12} />
              <span className="deploy-contract-pill-name">{contracts[0].name}</span>
              {contracts[0].path && contracts[0].path !== contracts[0].name && (
                <span className="deploy-contract-pill-path">{contracts[0].path}</span>
              )}
            </div>
          ) : (
            <select
              className="deploy-input"
              value={selectedContract?.path ?? ""}
              onChange={(e) => handleSelectContract(e.target.value)}
              disabled={compileStatus === "running" || deployStatus === "running"}
            >
              {groupedContracts.map(({ group, items }) =>
                group ? (
                  <optgroup key={group} label={group.toUpperCase()}>
                    {items.map((c) => (
                      <option key={c.path} value={c.path}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  items.map((c) => (
                    <option key={c.path || "__root__"} value={c.path}>
                      {c.name || "(workspace root)"}
                    </option>
                  ))
                )
              )}
            </select>
          )}

          {selectedContract && (
            <div className="deploy-hint deploy-hint-mono">
              {selectedContract.path
                ? `--manifest-path ${selectedContract.path}/Cargo.toml`
                : "Cargo.toml (workspace root)"}
            </div>
          )}
        </div>

        <button
          className="deploy-btn deploy-btn-primary"
          onClick={handleCompile}
          disabled={compileStatus === "running" || !selectedContract}
        >
          {compileStatus === "running" ? <Loader size={14} className="spin" /> : <Hammer size={14} />}
          {compileStatus === "running" ? "Compiling..." : "Build Contract"}
        </button>
      </Section>

      {/* ── Deploy ── */}
      <Section icon={<Rocket size={14} />} title="Deploy Contract" badge={<StatusBadge status={deployStatus} />}>
        {selectedContract && (
          <div className="deploy-target-banner">
            <Folder size={11} />
            <span>Deploying: <strong>{selectedContract.name}</strong></span>
          </div>
        )}
        <div className="deploy-form-group">
          <label className="deploy-label">Contract Alias</label>
          <input
            className="deploy-input"
            value={alias}
            onChange={e => { aliasEditedRef.current = true; setAlias(e.target.value); }}
            placeholder="my-contract"
          />
        </div>

        <div className="deploy-form-group">
          <label className="deploy-label">Source Account</label>
          <select
            className="deploy-input"
            value={sourceAccount}
            onChange={e => setSourceAccount(e.target.value)}
          >
            <option value="default">Default — {defaultWallet?.name || "stellar-ide-default"}</option>
            {walletAddress && (
              <option value="wallet">{walletProviders.find((w) => w.id === walletProviderId)?.label || "Wallet"} — {walletAddress.slice(0,6)}…{walletAddress.slice(-4)}</option>
            )}
          </select>
        </div>

        <div className="deploy-form-group">
          <label className="deploy-label">Network</label>
          <select
            className="deploy-input"
            value={deployNetwork}
            onChange={(e) => setDeployNetwork(e.target.value)}
          >
            <option value="testnet">Testnet</option>
            <option value="futurenet">Futurenet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        <div className="deploy-form-group">
          <label className="deploy-label">Salt Mode</label>
          <select
            className="deploy-input"
            value={saltMode}
            onChange={(e) => setSaltMode(e.target.value)}
          >
            <option value="random">Random (recommended)</option>
            <option value="manual">Manual (64-char hex)</option>
          </select>
          {saltMode === "manual" && (
            <input
              className="deploy-input"
              value={manualSalt}
              onChange={(e) => setManualSalt(e.target.value)}
              placeholder="e.g. 64-char lowercase hex salt"
            />
          )}
        </div>

        <div className="deploy-form-group deploy-preset-box">
          <label className="deploy-label">Deploy Presets (this contract)</label>
          <div className="deploy-preset-row">
            <select
              className="deploy-input"
              value={selectedPresetId}
              onChange={(e) => handleLoadPreset(e.target.value)}
            >
              <option value="">Select preset...</option>
              {deployPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              className="deploy-btn deploy-btn-secondary deploy-btn-small"
              type="button"
              disabled={!selectedPresetId}
              onClick={handleDeletePreset}
            >
              Delete
            </button>
          </div>
          <div className="deploy-preset-row">
            <input
              className="deploy-input"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
            />
            <button
              className="deploy-btn deploy-btn-secondary deploy-btn-small"
              type="button"
              disabled={!presetName.trim()}
              onClick={handleSavePreset}
            >
              Save Preset
            </button>
          </div>
        </div>

        <button
          className="deploy-btn deploy-btn-primary"
          onClick={handleDeploy}
          disabled={compileStatus !== "success" || deployStatus === "running"}
        >
          {deployStatus === "running" ? <Loader size={14} className="spin" /> : <Rocket size={14} />}
          {deployStatus === "running"
            ? "Deploying..."
            : (activeForSelected ? "Redeploy" : "Deploy")}
        </button>
        {compileStatus !== "success" && <div className="deploy-hint">Build must succeed first.</div>}
      </Section>

      {/* ── Deployed Contracts (grouped, multi-contract history) ── */}
      <Section
        icon={<CheckCircle size={14} />}
        title={`Deployed Contracts${groups.length > 0 ? ` (${groups.length})` : ""}`}
        defaultOpen={groups.length > 0}
      >
        {groups.length === 0 ? (
          <div className="deploy-hint">Deploy a contract to interact with it here.</div>
        ) : (
          <>
            <div className="deploy-history-toolbar">
              <div className="deploy-history-search">
                <Search size={12} />
                <input
                  className="deploy-input"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Search by alias, contract ID, wallet, path..."
                />
              </div>
              <div className="deploy-history-filters">
                <select className="deploy-input" value={historyContractFilter} onChange={(e) => setHistoryContractFilter(e.target.value)}>
                  <option value="all">All contracts</option>
                  {groups.map((g) => <option key={g.path} value={g.path}>{g.path}</option>)}
                </select>
                <select className="deploy-input" value={historyWalletFilter} onChange={(e) => setHistoryWalletFilter(e.target.value)}>
                  <option value="all">All wallets</option>
                  {historyFilterOptions.wallets.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <select className="deploy-input" value={historyNetworkFilter} onChange={(e) => setHistoryNetworkFilter(e.target.value)}>
                  <option value="all">All networks</option>
                  {historyFilterOptions.networks.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            {filteredGroups.length === 0 && (
              <div className="deploy-hint">No deployments match the current filters.</div>
            )}
            {filteredGroups.map((g) => (
              <DeploymentGroup
                key={g.path}
                group={g}
                contracts={contracts}
                invokeResults={invokeResults}
                invokingFn={invokingFn}
                fnArgs={fnArgs}
                expandedTest={expandedTest}
                copiedId={copiedId}
                onCopyId={handleCopyId}
                onInvoke={handleInvoke}
                onArgChange={setFnArgForContract}
                getSavedCases={savedCasesFor}
                onSaveCase={saveCurrentArgsAsCase}
                onApplyCase={applySavedCase}
                onDeleteCase={deleteSavedCase}
                onToggleTest={toggleTestExpanded}
                onPromote={promoteToActive}
                onTogglePinned={handleTogglePinned}
                onRemove={handleRemoveDeployment}
                onClearGroup={handleClearGroup}
                onOpenDiff={(newer, older) => setDiffPair({ newer, older })}
              />
            ))}
            <button className="deploy-history-clear" onClick={handleClearAll} disabled={filteredGroups.length === 0}>
              <Trash2 size={11} /> Clear all history
            </button>
          </>
        )}
      </Section>
      {diffPair && (
        <DeploymentDiffModal
          newer={diffPair.newer}
          older={diffPair.older}
          onClose={() => setDiffPair(null)}
        />
      )}
    </div>
  );
};

// ─── Group: one contract folder + its deployment history ────────────────────
const DeploymentGroup = ({
  group, contracts, invokeResults, invokingFn, fnArgs, expandedTest, copiedId,
  onCopyId, onInvoke, onArgChange, getSavedCases, onSaveCase, onApplyCase, onDeleteCase, onToggleTest, onPromote, onTogglePinned, onRemove, onClearGroup, onOpenDiff,
}) => {
  const [open, setOpen] = useState(true);
  const active = group.deployments.find((d) => d.status === "active") || group.deployments[0];
  const previous = group.deployments.filter((d) => d.id !== active?.id);
  // Prefer the live contract record's display name if the folder is still
  // around; fall back to the recorded crate name or the path itself.
  const live = contracts.find((c) => c.path === group.path);
  const displayName = live?.name || active?.crateName || group.path || "(unknown)";
  const orphaned = !live && group.path !== "__unknown__";

  if (!active) return null;

  return (
    <div className="deploy-group">
      <button className="deploy-group-header" onClick={() => setOpen((v) => !v)}>
        <Folder size={12} />
        <span className="deploy-group-name">{displayName}</span>
        <span className="deploy-group-count">
          {group.deployments.length} deploy{group.deployments.length === 1 ? "" : "s"}
        </span>
        {orphaned && <span className="deploy-group-orphan" title="Contract folder no longer in workspace">orphan</span>}
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className="deploy-group-body">
          <ActiveDeployment
            deployment={active}
            copiedId={copiedId}
            onCopyId={onCopyId}
            onTogglePinned={onTogglePinned}
            invokeResults={invokeResults}
            invokingFn={invokingFn}
            fnArgs={fnArgs}
            expanded={expandedTest.has(active.id)}
            onToggleTest={onToggleTest}
            onInvoke={onInvoke}
            onArgChange={onArgChange}
            getSavedCases={getSavedCases}
            onSaveCase={onSaveCase}
            onApplyCase={onApplyCase}
            onDeleteCase={onDeleteCase}
            onRemove={onRemove}
          />
          {previous.length > 0 && (
            <div className="deploy-previous-list">
              <div className="deploy-previous-label">Previous ({previous.length})</div>
              {previous.map((d) => (
                <PreviousRow
                  key={d.id}
                  deployment={d}
                  copiedId={copiedId}
                  onCopyId={onCopyId}
                  onPromote={onPromote}
                  onTogglePinned={onTogglePinned}
                  onDiff={() => onOpenDiff(active, d)}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
          <button className="deploy-group-clear" onClick={() => onClearGroup(group.path)}>
            <Trash2 size={10} /> Clear this contract's history
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Active deployment card (the headline entry for a group) ───────────────
const ActiveDeployment = ({
  deployment, copiedId, onCopyId, invokeResults, invokingFn, fnArgs, expanded,
  onToggleTest, onInvoke, onArgChange, getSavedCases, onSaveCase, onApplyCase, onDeleteCase, onTogglePinned, onRemove,
}) => {
  const fns = deployment.functions || [];
  const readFns  = fns.filter((f) => f.category === "read");
  const writeFns = fns.filter((f) => f.category === "write");
  const otherFns = fns.filter((f) => f.category === "unknown");
  const netClass = `deploy-network-badge net-${(deployment.network || "testnet").toLowerCase()}`;

  return (
    <div className="deploy-active-card">
      <div className="deploy-active-meta">
        <span className="deploy-active-flag">ACTIVE</span>
        <span className={netClass}>{deployment.network || "testnet"}</span>
        <span className="deploy-relative-time" title={new Date(deployment.deployedAt).toLocaleString()}>
          {formatRelativeTime(deployment.deployedAt)}
        </span>
      </div>
      {deployment.alias && (
        <div className="deploy-active-alias">{deployment.alias}</div>
      )}
      <div className="deploy-contract-id-row">
        <span className="deploy-contract-id" title={deployment.id}>
          {shortId(deployment.id)}
        </span>
        <button className="deploy-icon-btn" onClick={() => onCopyId(deployment.id)} title={deployment.id}>
          {copiedId === deployment.id ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <div className="deploy-active-actions">
        <button
          className={`deploy-btn deploy-btn-secondary deploy-btn-small ${deployment.pinned ? "is-pinned" : ""}`}
          onClick={() => onTogglePinned(deployment.path, deployment.id)}
          title={deployment.pinned ? "Unpin from top" : "Pin to top"}
        >
          <Star size={11} /> {deployment.pinned ? "Pinned" : "Pin"}
        </button>
        <a
          className="deploy-btn deploy-btn-secondary deploy-btn-small"
          href={explorerUrl(deployment.id, deployment.network)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={11} /> Explorer
        </a>
        <button
          className="deploy-btn deploy-btn-secondary deploy-btn-small"
          onClick={() => onToggleTest(deployment.id)}
          disabled={fns.length === 0}
          title={fns.length === 0 ? "No interface loaded — redeploy to fetch" : undefined}
        >
          <Play size={11} /> {expanded ? "Hide test" : "Test"}
        </button>
        <button
          className="deploy-btn-icon-danger"
          onClick={() => onRemove(deployment.path, deployment.id)}
          title="Remove from history"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {expanded && fns.length > 0 && (
        <div className="deploy-functions">
          {readFns.length > 0 && (
            <div className="deploy-fn-group">
              <div className="deploy-fn-group-label read">Read-only</div>
              {readFns.map((fn) => (
                <FnCard
                  key={fn.name}
                  fn={fn}
                  deployment={deployment}
                  args={fnArgs[deployment.id]?.[fn.name] || {}}
                  invoking={invokingFn[deployment.id] === fn.name}
                  result={invokeResults[deployment.id]?.[fn.name]}
                  onInvoke={onInvoke}
                  onArgChange={onArgChange}
                  savedCases={getSavedCases(deployment, fn.name)}
                  onSaveCase={onSaveCase}
                  onApplyCase={onApplyCase}
                  onDeleteCase={onDeleteCase}
                />
              ))}
            </div>
          )}
          {writeFns.length > 0 && (
            <div className="deploy-fn-group">
              <div className="deploy-fn-group-label write">Write</div>
              {writeFns.map((fn) => (
                <FnCard
                  key={fn.name}
                  fn={fn}
                  deployment={deployment}
                  args={fnArgs[deployment.id]?.[fn.name] || {}}
                  invoking={invokingFn[deployment.id] === fn.name}
                  result={invokeResults[deployment.id]?.[fn.name]}
                  onInvoke={onInvoke}
                  onArgChange={onArgChange}
                  savedCases={getSavedCases(deployment, fn.name)}
                  onSaveCase={onSaveCase}
                  onApplyCase={onApplyCase}
                  onDeleteCase={onDeleteCase}
                />
              ))}
            </div>
          )}
          {otherFns.length > 0 && (
            <div className="deploy-fn-group">
              <div className="deploy-fn-group-label unknown">Functions</div>
              {otherFns.map((fn) => (
                <FnCard
                  key={fn.name}
                  fn={fn}
                  deployment={deployment}
                  args={fnArgs[deployment.id]?.[fn.name] || {}}
                  invoking={invokingFn[deployment.id] === fn.name}
                  result={invokeResults[deployment.id]?.[fn.name]}
                  onInvoke={onInvoke}
                  onArgChange={onArgChange}
                  savedCases={getSavedCases(deployment, fn.name)}
                  onSaveCase={onSaveCase}
                  onApplyCase={onApplyCase}
                  onDeleteCase={onDeleteCase}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Previous deployment row (compact) ──────────────────────────────────────
const PreviousRow = ({ deployment, copiedId, onCopyId, onPromote, onTogglePinned, onDiff, onRemove }) => {
  return (
    <div className="deploy-previous-row">
      <span className="deploy-previous-id" title={deployment.id}>{shortId(deployment.id)}</span>
      <span className="deploy-previous-time" title={new Date(deployment.deployedAt).toLocaleString()}>
        {formatRelativeTime(deployment.deployedAt)}
      </span>
      <div className="deploy-previous-actions">
        <button
          className="deploy-icon-btn"
          onClick={() => onCopyId(deployment.id)}
          title="Copy contract ID"
        >
          {copiedId === deployment.id ? <Check size={11} /> : <Copy size={11} />}
        </button>
        <a
          className="deploy-icon-btn"
          href={explorerUrl(deployment.id, deployment.network)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in explorer"
        >
          <ExternalLink size={11} />
        </a>
        <button
          className="deploy-icon-btn"
          onClick={() => onPromote(deployment.path, deployment.id)}
          title="Make this the active deployment"
        >
          <ArrowUpCircle size={11} />
        </button>
        <button
          className={`deploy-icon-btn ${deployment.pinned ? "deploy-icon-btn-starred" : ""}`}
          onClick={() => onTogglePinned(deployment.path, deployment.id)}
          title={deployment.pinned ? "Unpin deployment" : "Pin deployment"}
        >
          <Star size={11} />
        </button>
        <button
          className="deploy-icon-btn"
          onClick={onDiff}
          title="Diff against active deployment"
        >
          Δ
        </button>
        <button
          className="deploy-icon-btn deploy-icon-btn-danger"
          onClick={() => onRemove(deployment.path, deployment.id)}
          title="Remove from history"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
};

const DeploymentDiffModal = ({ newer, older, onClose }) => {
  const newerFns = new Set((newer?.functions || []).map((f) => f.name));
  const olderFns = new Set((older?.functions || []).map((f) => f.name));
  const addedFns = [...newerFns].filter((n) => !olderFns.has(n));
  const removedFns = [...olderFns].filter((n) => !newerFns.has(n));
  const changed = [
    ["Contract ID", newer?.id, older?.id],
    ["Alias", newer?.alias || "(none)", older?.alias || "(none)"],
    ["Wallet", newer?.wallet || "(unknown)", older?.wallet || "(unknown)"],
    ["Wallet Address", newer?.walletAddress || "(unknown)", older?.walletAddress || "(unknown)"],
    ["Network", newer?.network || "(unknown)", older?.network || "(unknown)"],
    ["Deployed At", newer?.deployedAt ? new Date(newer.deployedAt).toLocaleString() : "-", older?.deployedAt ? new Date(older.deployedAt).toLocaleString() : "-"],
  ].filter(([, a, b]) => a !== b);

  return (
    <div className="deploy-diff-backdrop" onClick={onClose}>
      <div className="deploy-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deploy-diff-header">
          <div className="deploy-diff-title">Deployment Diff</div>
          <button className="deploy-icon-btn" onClick={onClose}>Close</button>
        </div>
        <div className="deploy-diff-subtitle">
          Comparing <code>{shortId(newer?.id)}</code> (active) vs <code>{shortId(older?.id)}</code> (previous)
        </div>
        <div className="deploy-diff-section">
          <div className="deploy-diff-section-title">Metadata changes</div>
          {changed.length === 0 ? (
            <div className="deploy-hint">No metadata differences.</div>
          ) : changed.map(([label, a, b]) => (
            <div key={label} className="deploy-diff-row">
              <span className="deploy-diff-key">{label}</span>
              <span className="deploy-diff-new">{String(a)}</span>
              <span className="deploy-diff-arrow">←</span>
              <span className="deploy-diff-old">{String(b)}</span>
            </div>
          ))}
        </div>
        <div className="deploy-diff-section">
          <div className="deploy-diff-section-title">Function signature set</div>
          <div className="deploy-diff-fn-grid">
            <div>
              <div className="deploy-fn-group-label read">Added ({addedFns.length})</div>
              {addedFns.length === 0 ? <div className="deploy-hint">None</div> : addedFns.map((n) => <div key={n} className="deploy-diff-fn-item">+ {n}</div>)}
            </div>
            <div>
              <div className="deploy-fn-group-label write">Removed ({removedFns.length})</div>
              {removedFns.length === 0 ? <div className="deploy-hint">None</div> : removedFns.map((n) => <div key={n} className="deploy-diff-fn-item">- {n}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Single function invoke card ────────────────────────────────────────────
const FnCard = ({
  fn, deployment, args, invoking, result, savedCases = [],
  onInvoke, onArgChange, onSaveCase, onApplyCase, onDeleteCase,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const params = fn.params || [];
  const resultValue = result?.output
    ? result.output.split("\n").filter(l => l.trim() && !l.startsWith("ℹ") && !l.startsWith("❌") && !l.startsWith("✅")).pop()?.trim()
    : null;

  return (
    <div className="deploy-fn-card">
      <div className="deploy-fn-name">fn {fn.name}()</div>
      {params.map((p) => (
        <div key={p.name} className="deploy-form-group">
          <label className="deploy-label">{p.name}: <span className="deploy-type">{p.type}</span></label>
          <input
            className="deploy-input"
            placeholder={p.type}
            value={args[p.name] || ""}
            onChange={(e) => onArgChange(deployment.id, fn.name, p.name, e.target.value)}
          />
        </div>
      ))}
      <div className="deploy-testcase-block">
        <div className="deploy-testcase-header">
          <span className="deploy-testcase-title">Saved test cases</span>
          <span className="deploy-testcase-count">{savedCases.length}</span>
        </div>
        <div className="deploy-testcase-row">
          <select
            className="deploy-input deploy-testcase-select"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
          >
            <option value="">Select test case...</option>
            {savedCases.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button
            className="deploy-btn deploy-btn-secondary deploy-btn-small"
            type="button"
            disabled={!selectedCaseId}
            onClick={() => {
              onApplyCase(deployment, fn.name, selectedCaseId);
              setSelectedCaseId("");
            }}
          >
            Load
          </button>
          <button
            className="deploy-btn deploy-btn-secondary deploy-btn-small"
            type="button"
            onClick={() => onSaveCase(deployment, fn)}
          >
            Save
          </button>
        </div>
      </div>
      {savedCases.length > 0 && (
        <div className="deploy-testcase-list">
          {savedCases.slice(0, 4).map((c) => (
            <button
              key={c.id}
              className="deploy-testcase-chip"
              type="button"
              onClick={() => onApplyCase(deployment, fn.name, c.id)}
              title={`Load ${c.label}`}
            >
              {c.label}
              <span
                className="deploy-testcase-chip-x"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCase(deployment, fn.name, c.id);
                }}
                title="Delete case"
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      {savedCases.length === 0 && (
        <div className="deploy-hint">No saved test cases yet. Fill args and click Save.</div>
      )}
      <button className="deploy-btn deploy-btn-invoke" onClick={() => onInvoke(deployment, fn)} disabled={invoking}>
        {invoking ? <Loader size={11} className="spin" /> : <Play size={11} />}
        {invoking ? "Calling…" : "Call"}
      </button>
      {result?.error && <pre className="deploy-fn-result error">{result.error}</pre>}
      {!result?.error && resultValue && <pre className="deploy-fn-result success">{resultValue}</pre>}
    </div>
  );
};

export default DeployPanel;
