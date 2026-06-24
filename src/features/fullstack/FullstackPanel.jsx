import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Triangle, Sparkles, X, Laptop2, Globe } from "lucide-react";
import { useFullstack } from "../../context/FullstackContext";
import { useContract } from "../../context/ContractContext";
import VercelConnect from "./VercelConnect";
import ProjectList from "./ProjectList";
import DeploymentList from "./DeploymentList";
import DeploymentDetail from "./DeploymentDetail";
import NewDeploymentModal from "./NewDeploymentModal";
import LocalDeployView from "./LocalDeployView";
import { writeFrontendPreviewEnv, shouldAutoWritePreviewEnv } from "../preview/previewEnvWriter";
import { detectFrontendRoot } from "./fullstackBundler";

const MODE_KEY = "soroban.fullstackMode";

const shortId = (id) => (id && id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id || "");

/**
 * Locate (or build a plan to create) the `.env` file inside the detected
 * frontend folder. Returns { node, parentFolderId } — `node` is null when
 * the file doesn't exist yet, in which case `parentFolderId` is where it
 * should be created.
 */
const locateEnvFile = (treeData) => {
  const detection = detectFrontendRoot(treeData);
  if (!detection.folder) return { node: null, parentFolderId: null, detection };

  const folder = detection.folder;
  const existing = (folder.children || []).find(
    (c) => c.type === "file" && c.name === ".env",
  );
  return {
    node: existing || null,
    parentFolderId: folder.id,
    detection,
  };
};

/**
 * Top-level switcher for the Fullstack panel. Drives three "screens":
 *   1. Disconnected → VercelConnect
 *   2. Connected, no project selected → ProjectList
 *   3. Project selected, no deployment open → DeploymentList
 *   4. Deployment open → DeploymentDetail
 *
 * The "New Deployment" modal is owned here so it overlays every screen.
 */
const FullstackPanel = ({ treeData, fileContents, setFileContents, setTreeData }) => {
  const {
    isConnected,
    user,
    selectedProjectId,
    selectProject,
    selectedDeploymentId,
    selectDeployment,
    disconnect,
  } = useFullstack();

  const { contractId, walletAddress, connectWallet } = useContract();

  const [showNew, setShowNew] = useState(false);
  const [initialEnvRows, setInitialEnvRows] = useState(null);

  // Top-level mode toggle: "local" (no Vercel needed) vs "vercel" (production).
  // We default new users to "local" — they can prove the app works on their
  // machine before signing into a third-party platform.
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) || "local";
    } catch {
      return "local";
    }
  });
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  // Most-recent contract that landed via the Deploy panel. We keep a short
  // history so it survives panel re-renders, but only ever show the latest.
  const [pendingContract, setPendingContract] = useState(null); // { contractId, name, network }

  // Auto-close the modal once a successful deploy comes in — the user lands
  // on the new deployment's detail view instead.
  const handleDeployed = useCallback((dep) => {
    const id = dep?.id || dep?.uid;
    if (id) selectDeployment(id);
    setShowNew(false);
    setInitialEnvRows(null);
  }, [selectDeployment]);

  // If the user disconnects mid-flow, clean up local view state.
  useEffect(() => {
    if (!isConnected) {
      setShowNew(false);
      setInitialEnvRows(null);
    }
  }, [isConnected]);

  // Cross-panel bridge: the Preview panel's "Deploy and preview" CTA fires
  // this event so we open the deploy modal without the user re-clicking.
  // We also force-switch to the Vercel tab so the user sees the modal in
  // the right context.
  useEffect(() => {
    const handler = () => {
      setMode("vercel");
      if (isConnected) setShowNew(true);
      // When not connected, the VercelConnect view is already what the user
      // sees on this panel — no extra action needed.
    };
    window.addEventListener("soroban:openVercelDeploy", handler);
    return () => window.removeEventListener("soroban:openVercelDeploy", handler);
  }, [isConnected]);

  const envLocation = useMemo(() => locateEnvFile(treeData), [treeData]);

  // Best-effort write to `frontend/.env`. Updates the existing file when
  // present; otherwise creates one alongside the detected frontend folder.
  // No-ops cleanly if neither setter was wired in.
  const writeEnvFile = useCallback((envContent) => {
    const { node, parentFolderId } = envLocation;

    if (node && typeof setFileContents === "function") {
      setFileContents((prev) => ({ ...prev, [node.id]: envContent }));
      return true;
    }
    if (!parentFolderId) return false;
    if (typeof setTreeData !== "function" || typeof setFileContents !== "function") {
      return false;
    }

    // Create a new `.env` node under the frontend folder.
    const newId = `${parentFolderId}/.env-${Date.now()}`;
    const newNode = { id: newId, name: ".env", type: "file", children: [] };

    setTreeData((prev) => {
      const insert = (nodes) =>
        (nodes || []).map((n) => {
          if (n.id === parentFolderId) {
            return { ...n, children: [...(n.children || []), newNode] };
          }
          if (n.children?.length) {
            return { ...n, children: insert(n.children) };
          }
          return n;
        });
      return insert(prev);
    });
    setFileContents((prev) => ({ ...prev, [newId]: envContent }));
    return true;
  }, [envLocation, setFileContents, setTreeData]);

  const handleAutoInject = useCallback(() => {
    if (!pendingContract) return;
    const { contractId, network } = pendingContract;
    const env = [
      { key: "VITE_CONTRACT_ID", value: contractId },
      { key: "VITE_NETWORK", value: network || "TESTNET" },
    ];
    setInitialEnvRows(env);

    // Mirror the same values into frontend/.env so `npm run dev` picks
    // them up locally without the user having to edit anything.
    const envContent = `# Auto-generated after contract deploy\n${env
      .map(({ key, value }) => `${key}=${value}`)
      .join("\n")}\n`;
    writeEnvFile(envContent);

    setShowNew(true);
    setPendingContract(null);
  }, [pendingContract, writeEnvFile]);

  // Local-flow variant: write the env file without opening the Vercel
  // modal. Returns true if the write succeeded so the LocalDeployView can
  // show a "saved" toast.
  const handleApplyEnvLocal = useCallback((vars) => {
    if (!vars) return false;
    const entries = Object.entries(vars);
    if (entries.length === 0) return false;
    const envContent = `# Auto-generated after contract deploy\n${entries
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`;
    return writeEnvFile(envContent);
  }, [writeEnvFile]);

  // Listen for contract deploys coming from the Deploy panel so we can
  // offer to auto-inject the new contract ID into the frontend env.
  useEffect(() => {
    const handler = (e) => {
      const { contractId, name, network, path } = e.detail || {};
      if (!contractId) return;
      const viteNetwork = network === "mainnet" || network === "public"
        ? "MAINNET"
        : "TESTNET";

      if (!shouldAutoWritePreviewEnv(treeData, fileContents, path)) return;

      writeFrontendPreviewEnv({
        treeData,
        setFileContents,
        setTreeData,
        contractId,
        network,
        deployPath: path,
        fileContents,
      });

      setPendingContract({ contractId, name, network: viteNetwork });
    };
    window.addEventListener("soroban:contractDeployed", handler);
    return () => window.removeEventListener("soroban:contractDeployed", handler);
  }, [treeData, fileContents, setFileContents, setTreeData]);

  const handleDismiss = useCallback(() => setPendingContract(null), []);

  return (
    <div className="fs-panel">
      <ModeTabs mode={mode} onChange={setMode} connected={isConnected} />

      {mode === "local" ? (
        <LocalDeployView
          treeData={treeData}
          fileContents={fileContents}
          pendingContract={pendingContract}
          onApplyEnv={handleApplyEnvLocal}
          onClearContract={() => setPendingContract(null)}
          contractId={contractId}
          walletAddress={walletAddress}
          onConnectWallet={connectWallet}
        />
      ) : !isConnected ? (
        <>
          {pendingContract && (
            <ContractDeployedBanner
              contract={pendingContract}
              connected={false}
              onDismiss={handleDismiss}
            />
          )}
          <VercelConnect />
        </>
      ) : (
        <>
          <div className="fs-account-bar">
            <div className="fs-account-bar-id">
              {user?.avatar ? (
                <img
                  className="fs-avatar"
                  src={`https://vercel.com/api/www/avatar/${user.avatar}?s=44`}
                  alt=""
                />
              ) : (
                <Triangle size={11} fill="currentColor" />
              )}
              <span>{user?.username || user?.name || user?.email || "Vercel"}</span>
            </div>
            <button
              className="fs-icon-btn"
              onClick={disconnect}
              title="Disconnect Vercel"
            >
              <LogOut size={12} />
            </button>
          </div>

          {pendingContract && (
            <ContractDeployedBanner
              contract={pendingContract}
              connected
              onAutoInject={handleAutoInject}
              onDismiss={handleDismiss}
            />
          )}

          {!selectedProjectId ? (
            <ProjectList onCreateNew={() => setShowNew(true)} />
          ) : selectedDeploymentId ? (
            <DeploymentDetail
              deploymentId={selectedDeploymentId}
              onBack={() => selectDeployment(null)}
            />
          ) : (
            <DeploymentList
              onBack={() => selectProject(null)}
              onOpenDetail={(id) => selectDeployment(id)}
              onNewDeployment={() => setShowNew(true)}
            />
          )}
        </>
      )}

      {showNew && (
        <NewDeploymentModal
          treeData={treeData}
          fileContents={fileContents}
          initialEnvRows={initialEnvRows}
          onClose={() => {
            setShowNew(false);
            setInitialEnvRows(null);
          }}
          onDeployed={handleDeployed}
        />
      )}
    </div>
  );
};

/**
 * Two-pill tab toggle: "Local" (zero-config, no third party) on the left,
 * "Vercel" (production deploy) on the right. The Vercel pill shows a
 * subtle dot when the user is connected so they remember they're signed in
 * even while previewing locally.
 */
const ModeTabs = ({ mode, onChange, connected }) => (
  <div className="fs-mode-tabs" role="tablist">
    <button
      role="tab"
      aria-selected={mode === "local"}
      className={`fs-mode-tab ${mode === "local" ? "is-active" : ""}`}
      onClick={() => onChange("local")}
    >
      <Laptop2 size={12} /> Local
    </button>
    <button
      role="tab"
      aria-selected={mode === "vercel"}
      className={`fs-mode-tab ${mode === "vercel" ? "is-active" : ""}`}
      onClick={() => onChange("vercel")}
    >
      <Globe size={12} /> Vercel
      {connected && <span className="fs-mode-tab-dot" title="Vercel connected" />}
    </button>
  </div>
);

/**
 * Slim inline banner that surfaces a freshly-deployed contract and offers a
 * single-click path to auto-fill VITE_CONTRACT_ID and redeploy.
 */
const ContractDeployedBanner = ({ contract, connected, onAutoInject, onDismiss }) => (
  <div className="fs-inject-banner">
    <div className="fs-inject-banner-icon">
      <Sparkles size={12} />
    </div>
    <div className="fs-inject-banner-body">
      <div className="fs-inject-banner-title">
        Contract deployed <code>{shortId(contract.contractId)}</code>
      </div>
      <div className="fs-inject-banner-sub">
        {connected
          ? `Use it as VITE_CONTRACT_ID and redeploy your frontend?`
          : `Connect Vercel above to auto-inject this contract ID into your frontend deploy.`}
      </div>
    </div>
    <div className="fs-inject-banner-actions">
      {connected && (
        <button
          className="fs-btn fs-btn-primary fs-btn-small"
          onClick={onAutoInject}
        >
          Auto-fill and deploy
        </button>
      )}
      <button
        className="fs-icon-btn"
        onClick={onDismiss}
        title="Dismiss"
      >
        <X size={11} />
      </button>
    </div>
  </div>
);

export default FullstackPanel;
