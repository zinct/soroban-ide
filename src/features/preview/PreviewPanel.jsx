import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  ExternalLink,
  Laptop2,
  AlertCircle,
  Download,
  Loader,
  CheckCircle,
  Sparkles,
  Play,
  Settings2,
  Zap,
  Wallet,
  FileCode,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { detectFrontendRoot } from "../fullstack/fullstackBundler";
import { downloadFrontendZip } from "./downloadFrontend";
import { watchLocalServer } from "../../services/localServerProbe";
import { bundleFrontendInBrowser } from "../../services/inBrowserBundler";
import {
  handlePreviewWalletRequest,
  PREVIEW_WALLET_REQUEST,
} from "../../services/previewWalletBridge";
import { dispatchPreviewLog, logPreviewActivity, PREVIEW_LOG_MESSAGE } from "../../services/previewConsoleBridge";
import { signFreighterTransaction } from "../../services/freighter";
import { useContract } from "../../context/ContractContext";
import { useDeploy } from "../../context/DeployContext";
import { resolvePreviewContract } from "../deploy/deploymentHistory";
import {
  fingerprintFrontend,
  parsePreviewEnv,
  BUILD_STAGE_ORDER,
  BUILD_STAGE_LABELS,
  BUILD_STAGE_PROGRESS,
  shortContractId,
} from "./previewUtils";

const LAST_LOCAL_URL_KEY = "soroban.lastLocalPreviewUrl";
const LOCAL_MODE_KEY = "soroban.localPreviewMode"; // "in-ide" | "external"
const AUTO_LIVE_KEY = "soroban.previewAutoLive";
const DEFAULT_LOCAL_URL = "http://localhost:5173";

const DEVICE_PRESETS = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: null },
  { id: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: 390 },
];

const normalizeUrl = (raw) => {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `http://${v}`;
};

const PreviewPanel = ({ treeData, fileContents, isActive = true }) => {
  const { walletAddress, walletNetworkPassphrase, connectWallet } = useContract();
  const { deploymentHistory } = useDeploy();
  const detection = useMemo(() => detectFrontendRoot(treeData), [treeData]);

  const previewEnv = useMemo(
    () => parsePreviewEnv(detection, fileContents),
    [detection, fileContents],
  );

  const previewContract = useMemo(
    () => resolvePreviewContract(deploymentHistory, previewEnv),
    [deploymentHistory, previewEnv],
  );

  // "in-ide" — bundle in the browser (default) | "external" — localhost dev server
  const [localMode, setLocalMode] = useState(() => {
    try { return localStorage.getItem(LOCAL_MODE_KEY) || "in-ide"; }
    catch { return "in-ide"; }
  });
  useEffect(() => {
    try { localStorage.setItem(LOCAL_MODE_KEY, localMode); } catch { /* ignore */ }
  }, [localMode]);

  const [localUrl, setLocalUrl] = useState(() => {
    try { return localStorage.getItem(LAST_LOCAL_URL_KEY) || DEFAULT_LOCAL_URL; }
    catch { return DEFAULT_LOCAL_URL; }
  });

  const [deviceId, setDeviceId] = useState("desktop");
  const [reloadCounter, setReloadCounter] = useState(0);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [downloadState, setDownloadState] = useState({ kind: "idle" });
  const [externalStatus, setExternalStatus] = useState({ phase: "checking" });

  // In-IDE bundle state.
  // phase: "idle" | "building" | "ready" | "error"
  const [buildState, setBuildState] = useState({ phase: "idle" });
  const [autoLive, setAutoLive] = useState(() => {
    try { return localStorage.getItem(AUTO_LIVE_KEY) !== "false"; }
    catch { return true; }
  });
  const [hintsOpen, setHintsOpen] = useState(false);
  const blobUrlRef = useRef(null);
  const auxBlobUrlsRef = useRef([]);
  const iframeRef = useRef(null);
  const lastBuiltFingerprintRef = useRef("");
  const buildInFlightRef = useRef(false);
  const frontendFingerprint = useMemo(
    () => fingerprintFrontend(detection, fileContents),
    [detection, fileContents],
  );

  useEffect(() => {
    try { localStorage.setItem(AUTO_LIVE_KEY, autoLive ? "true" : "false"); }
    catch { /* ignore */ }
  }, [autoLive]);

  // ─── Persistence + cross-tab sync ─────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(LAST_LOCAL_URL_KEY, localUrl); } catch { /* ignore */ }
  }, [localUrl]);

  // ─── Bundle action ────────────────────────────────────────────────────
  // Revoke every blob URL from the previous build (HTML + JS module) so we
  // don't leak memory across rebuilds.
  const setPreviewBlobs = useCallback((htmlUrl, auxUrls = []) => {
    for (const url of auxBlobUrlsRef.current) {
      if (url && url !== htmlUrl && !auxUrls.includes(url)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
    }
    if (blobUrlRef.current && blobUrlRef.current !== htmlUrl) {
      try { URL.revokeObjectURL(blobUrlRef.current); } catch { /* ignore */ }
    }
    blobUrlRef.current = htmlUrl || null;
    auxBlobUrlsRef.current = auxUrls.filter(Boolean);
  }, []);

  const postWalletToIframe = useCallback(() => {
    if (!walletAddress || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { source: "soroban-ide", type: "soroban:wallet", address: walletAddress },
      "*",
    );
  }, [walletAddress]);

  const handleIframeLoad = useCallback(() => {
    setLoadedOnce(true);
    postWalletToIframe();
    logPreviewActivity("[preview] UI loaded — interact with the app to see activity here");
  }, [postWalletToIframe]);

  // Push wallet updates into the preview when the Deploy panel connects
  // or switches accounts — blob iframes can't talk to Freighter directly.
  useEffect(() => {
    postWalletToIframe();
  }, [walletAddress, buildState.phase, reloadCounter, postWalletToIframe]);

  // Route Freighter popups and preview console logs through the parent IDE.
  useEffect(() => {
    const onMessage = (event) => {
      const frameWin = iframeRef.current?.contentWindow;
      if (!frameWin || event.source !== frameWin) return;
      const data = event.data;
      if (data?.source !== "soroban-preview") return;

      if (data.type === PREVIEW_WALLET_REQUEST) {
        handlePreviewWalletRequest(data, {
          eventSource: event.source,
          walletAddress,
          walletNetworkPassphrase,
          connectWallet,
          signTransaction: signFreighterTransaction,
        });
        return;
      }

      if (data.type === PREVIEW_LOG_MESSAGE) {
        dispatchPreviewLog(data);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [walletAddress, walletNetworkPassphrase, connectWallet]);

  const runBuild = useCallback(async () => {
    if (buildInFlightRef.current) return;
    buildInFlightRef.current = true;
    logPreviewActivity("--- Preview rebuild started ---");
    setBuildState({ phase: "building", stage: "collect", message: "Reading workspace files..." });
    setLoadedOnce(false);
    try {
      const result = await bundleFrontendInBrowser(treeData, fileContents, {
        onProgress: (p) => {
          setBuildState({ phase: "building", stage: p.stage, message: p.message });
        },
        walletAddress: walletAddress || undefined,
        contractId: previewContract?.contractId || undefined,
        network: previewContract?.network,
      });
      setPreviewBlobs(result.blobUrl, result.auxBlobUrls);
      lastBuiltFingerprintRef.current = frontendFingerprint;
      setBuildState({
        phase: "ready",
        blobUrl: result.blobUrl,
        durationMs: result.durationMs,
        bytes: result.bytes,
        warnings: result.warnings,
        entry: result.entry,
      });
      logPreviewActivity(
        `Preview built in ${Math.round(result.durationMs)}ms (${(result.bytes / 1024).toFixed(0)} KB) — entry ${result.entry || "?"}`,
      );
      setReloadCounter((n) => n + 1);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      logPreviewActivity(`Build failed: ${message}`, "error");
      setBuildState({
        phase: "error",
        message,
        details: err && err.details ? err.details : [],
      });
    } finally {
      buildInFlightRef.current = false;
    }
  }, [treeData, fileContents, walletAddress, previewContract, frontendFingerprint, setPreviewBlobs]);

  // Listen for "soroban:runInIdeBuild" — opens preview (via Sidebar) then builds.
  useEffect(() => {
    const handler = () => {
      setLocalMode("in-ide");
      runBuild();
    };
    window.addEventListener("soroban:runInIdeBuild", handler);
    return () => window.removeEventListener("soroban:runInIdeBuild", handler);
  }, [runBuild]);

  // Live rebuild — when frontend files change and a preview is already running.
  useEffect(() => {
    if (!autoLive || localMode !== "in-ide") return undefined;
    if (buildState.phase !== "ready" || !frontendFingerprint) return undefined;
    if (!lastBuiltFingerprintRef.current) {
      lastBuiltFingerprintRef.current = frontendFingerprint;
      return undefined;
    }
    if (lastBuiltFingerprintRef.current === frontendFingerprint) return undefined;
    const timer = setTimeout(() => runBuild(), 500);
    return () => clearTimeout(timer);
  }, [autoLive, localMode, buildState.phase, frontendFingerprint, runBuild]);

  // ⌘/Ctrl+Shift+B — quick rebuild while the preview panel is open.
  useEffect(() => {
    if (!isActive) return undefined;
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== "b") return;
      if (localMode !== "in-ide") return;
      e.preventDefault();
      runBuild();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, localMode, runBuild]);

  const openPanel = useCallback((panel) => {
    window.dispatchEvent(new CustomEvent("soroban:setSidebarPanel", { detail: { panel } }));
  }, []);

  // External dev-server URL (advanced fallback).
  useEffect(() => {
    const handler = (e) => {
      const url = e.detail?.url;
      if (typeof url === "string" && url.trim()) {
        setLocalUrl(url.trim());
      }
      setLocalMode("external");
      setLoadedOnce(false);
      setReloadCounter((n) => n + 1);
    };
    window.addEventListener("soroban:setPreviewLocalUrl", handler);
    return () => window.removeEventListener("soroban:setPreviewLocalUrl", handler);
  }, []);

  // ─── External URL probe (only when localMode === "external") ──────────
  const prevOnlineRef = useRef(false);
  useEffect(() => {
    if (localMode !== "external") return undefined;
    const normalized = normalizeUrl(localUrl);
    if (!normalized) return undefined;
    const stop = watchLocalServer(normalized, (res) => {
      setExternalStatus({ phase: res.ok ? "online" : "offline", reason: res.reason });
      if (res.ok && !prevOnlineRef.current) {
        prevOnlineRef.current = true;
        setLoadedOnce(false);
        setReloadCounter((n) => n + 1);
      } else if (!res.ok) {
        prevOnlineRef.current = false;
      }
    }, { intervalMs: 3000, timeoutMs: 1500 });
    return stop;
  }, [localMode, localUrl]);

  // Clean up the blob URL on unmount so it doesn't leak after the user
  // closes the panel.
  useEffect(() => () => {
    if (blobUrlRef.current) {
      try { URL.revokeObjectURL(blobUrlRef.current); } catch { /* ignore */ }
      blobUrlRef.current = null;
    }
    for (const url of auxBlobUrlsRef.current) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    auxBlobUrlsRef.current = [];
  }, []);

  // ─── Derived state ────────────────────────────────────────────────────
  const device = DEVICE_PRESETS.find((d) => d.id === deviceId) || DEVICE_PRESETS[0];

  const activeUrl = useMemo(() => {
    if (localMode === "in-ide") return buildState.phase === "ready" ? buildState.blobUrl : "";
    return normalizeUrl(localUrl);
  }, [localMode, buildState, localUrl]);

  const refresh = useCallback(() => {
    setLoadedOnce(false);
    if (localMode === "in-ide") {
      runBuild();
      return;
    }
    setReloadCounter((n) => n + 1);
  }, [localMode, runBuild]);

  const openInNewTab = useCallback(() => {
    if (activeUrl) window.open(activeUrl, "_blank", "noopener,noreferrer");
  }, [activeUrl]);

  const handleDownload = useCallback(async () => {
    setDownloadState({ kind: "loading" });
    try {
      const { filename, fileCount } = await downloadFrontendZip(treeData, fileContents);
      setDownloadState({ kind: "ok", filename, fileCount });
      setTimeout(() => setDownloadState({ kind: "idle" }), 4000);
    } catch (err) {
      setDownloadState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [treeData, fileContents]);

  const showLocalEmpty = detection.kind === "empty";
  const localHasFrontend = detection.kind !== "empty";
  const hasContract = Boolean(
    previewContract?.contractId || previewEnv.VITE_CONTRACT_ID?.startsWith("C"),
  );
  const hasWallet = Boolean(walletAddress);
  const readyToRun = localHasFrontend;

  const goDeploy = useCallback(() => openPanel("deploy"), [openPanel]);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="pv-panel">
      <div className="pv-header">
        {localMode === "in-ide" ? (
          <div className="pv-action-row">
            <button
              className={`pv-live-toggle ${autoLive ? "is-on" : ""}`}
              onClick={() => setAutoLive((v) => !v)}
              title={autoLive
                ? "Live rebuild on — edits to frontend/ auto-refresh the preview"
                : "Live rebuild off — click Rebuild after edits"}
            >
              <Zap size={12} />
              <span>Live</span>
            </button>
            <button
              className="pv-cta-btn pv-cta-primary pv-action-run"
              onClick={runBuild}
              disabled={buildState.phase === "building" || !localHasFrontend}
              title="Bundle the workspace and run it inside the IDE (⌘⇧B)"
            >
              {buildState.phase === "building"
                ? <><Loader size={12} className="pv-spin" /> Building...</>
                : buildState.phase === "ready"
                  ? <><RefreshCw size={12} /> Rebuild</>
                  : <><Play size={12} /> Run in IDE</>}
            </button>
            <button
              className="pv-icon-btn"
              onClick={() => setLocalMode("external")}
              title="Use an external dev server URL instead"
            >
              <Settings2 size={12} />
            </button>
            <button
              className="pv-icon-btn"
              onClick={openInNewTab}
              disabled={!activeUrl}
              title="Open in new tab"
            >
              <ExternalLink size={12} />
            </button>
          </div>
        ) : (
          <div className="pv-url-row">
            <input
              className="pv-url-input"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") refresh(); }}
              placeholder="http://localhost:5173"
              spellCheck={false}
            />
            <button
              className="pv-icon-btn"
              onClick={() => setLocalMode("in-ide")}
              title="Back to in-IDE preview"
            >
              <Laptop2 size={12} />
            </button>
            <button
              className="pv-icon-btn"
              onClick={refresh}
              disabled={!activeUrl}
              title="Reload preview"
            >
              <RefreshCw size={12} />
            </button>
            <button
              className="pv-icon-btn"
              onClick={openInNewTab}
              disabled={!activeUrl}
              title="Open in new tab"
            >
              <ExternalLink size={12} />
            </button>
          </div>
        )}

        {localMode === "in-ide" && localHasFrontend && (
          <ReadinessStrip
            hasContract={hasContract}
            hasWallet={hasWallet}
            contractId={previewContract?.contractId}
            walletAddress={walletAddress}
            autoLive={autoLive}
            buildPhase={buildState.phase}
            onDeploy={goDeploy}
            onConnectWallet={connectWallet}
          />
        )}

        <div className="pv-device-row">
          {DEVICE_PRESETS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`pv-device-btn ${deviceId === id ? "is-active" : ""}`}
              onClick={() => setDeviceId(id)}
              title={label}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pv-body">
        {showLocalEmpty ? (
          <EmptyState
            icon={<AlertCircle size={20} />}
            title="No workspace loaded"
            subtitle="Open a project that contains a frontend folder to use the preview."
          />
        ) : localMode === "in-ide" ? (
          <InIdeBody
            buildState={buildState}
            device={device}
            deviceId={deviceId}
            reloadCounter={reloadCounter}
            iframeRef={iframeRef}
            onLoad={handleIframeLoad}
            onRun={runBuild}
            readyToRun={readyToRun}
            hasContract={hasContract}
            hasWallet={hasWallet}
            onDeploy={goDeploy}
            onConnectWallet={connectWallet}
          />
        ) : (
          <ExternalBody
            url={activeUrl}
            phase={externalStatus.phase}
            device={device}
            deviceId={deviceId}
            reloadCounter={reloadCounter}
            iframeRef={iframeRef}
            onLoad={handleIframeLoad}
            folderPath={detection.kind === "subfolder" ? detection.path : null}
            refresh={refresh}
          />
        )}

        {localMode === "in-ide" && buildState.phase !== "ready" && (
          <LocalHints
            detection={detection}
            downloadState={downloadState}
            onDownload={handleDownload}
          />
        )}
        {localMode === "in-ide" && buildState.phase === "ready" && (
          <div className="pv-hints-collapsed">
            <button
              type="button"
              className="pv-hints-toggle"
              onClick={() => setHintsOpen((v) => !v)}
              aria-expanded={hintsOpen}
            >
              {hintsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {hintsOpen ? "Hide tips" : "Download frontend"}
            </button>
            {hintsOpen && (
              <LocalHints
                detection={detection}
                downloadState={downloadState}
                onDownload={handleDownload}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Subcomponents ──────────────────────────────────────────────────────── */

const EmptyState = ({ icon, title, subtitle, primaryAction }) => (
  <div className="pv-empty">
    <div className="pv-empty-icon">{icon}</div>
    <div className="pv-empty-title">{title}</div>
    <div className="pv-empty-sub">{subtitle}</div>
    {primaryAction && (
      <button className="pv-cta-btn pv-cta-primary" onClick={primaryAction.onClick}>
        {primaryAction.icon} {primaryAction.label}
      </button>
    )}
  </div>
);

const ReadinessStrip = ({
  hasContract,
  hasWallet,
  contractId,
  walletAddress,
  autoLive,
  buildPhase,
  onDeploy,
  onConnectWallet,
}) => (
  <div className="pv-readiness">
    <ReadinessChip
      ok={hasContract}
      icon={<FileCode size={11} />}
      label={hasContract ? `Contract ${shortContractId(contractId)}` : "No contract ID"}
      actionLabel={hasContract ? null : "Deploy"}
      onAction={hasContract ? null : onDeploy}
    />
    <ReadinessChip
      ok={hasWallet}
      icon={<Wallet size={11} />}
      label={hasWallet ? `Wallet ${shortContractId(walletAddress)}` : "No wallet"}
      actionLabel={hasWallet ? null : "Connect"}
      onAction={hasWallet ? null : onConnectWallet}
    />
    {buildPhase === "ready" && autoLive && (
      <span className="pv-readiness-live">
        <Zap size={10} /> Live rebuild on
      </span>
    )}
  </div>
);

const ReadinessChip = ({ ok, icon, label, actionLabel, onAction }) => (
  <div className={`pv-chip ${ok ? "is-ok" : "is-warn"}`}>
    <span className="pv-chip-icon">{icon}</span>
    <span className="pv-chip-label">{label}</span>
    {!ok && actionLabel && onAction && (
      <button type="button" className="pv-chip-action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

/**
 * The default Local body: build the workspace in the browser and frame it.
 */
const InIdeBody = ({
  buildState,
  device,
  deviceId,
  reloadCounter,
  iframeRef,
  onLoad,
  onRun,
  readyToRun,
  hasContract,
  hasWallet,
  onDeploy,
  onConnectWallet,
}) => {
  if (buildState.phase === "idle") {
    return (
      <div className="pv-build-idle">
        <div className="pv-build-icon"><Play size={22} /></div>
        <div className="pv-build-title">
          {readyToRun ? "Ready to preview" : "Set up, then run"}
        </div>
        <div className="pv-build-sub">
          {readyToRun
            ? hasContract
              ? <>Your frontend and contract are linked. One click compiles and frames your app here.</>
              : <>Your frontend is ready. Connect a contract via Deploy or <code>.env</code> to test on-chain calls.</>
            : <>Add a <code>frontend/</code> folder with an <code>index.html</code> entry point.</>}
        </div>

        <div className="pv-launch-steps">
          <LaunchStep
            done
            title="Frontend detected"
            sub="TypeScript / JSX compile in-browser"
          />
          <LaunchStep
            done={hasContract}
            title="Contract linked"
            sub={hasContract ? "ID wired from .env or latest deploy" : "Deploy any contract or add VITE_CONTRACT_ID to .env"}
            action={hasContract ? null : { label: "Open Deploy", onClick: onDeploy }}
          />
          <LaunchStep
            done={hasWallet}
            title="Wallet connected"
            sub={hasWallet ? "Freighter linked — write actions open the wallet popup" : "Connect to test contract transactions in the preview"}
            action={hasWallet ? null : { label: "Connect", onClick: onConnectWallet }}
          />
        </div>

        <button
          className={`pv-cta-btn pv-cta-primary pv-build-cta ${readyToRun ? "pv-build-cta-ready" : ""}`}
          onClick={onRun}
        >
          <Play size={12} /> Run in IDE
        </button>
        <div className="pv-build-fine">
          Turn on <strong>Live</strong> above — edits to <code>frontend/</code> auto-rebuild in ~1s.
          Shortcut: <kbd>⌘⇧B</kbd>
        </div>
      </div>
    );
  }

  if (buildState.phase === "building") {
    const progress = BUILD_STAGE_PROGRESS[buildState.stage] ?? 8;
    return (
      <div className="pv-build-progress">
        <Loader size={22} className="pv-spin" />
        <div className="pv-build-title">{buildState.message || "Building..."}</div>
        <div className="pv-build-progress-bar" aria-hidden="true">
          <div className="pv-build-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <BuildStages stage={buildState.stage} />
      </div>
    );
  }

  if (buildState.phase === "error") {
    return (
      <div className="pv-build-error">
        <AlertCircle size={20} />
        <div className="pv-build-error-title">Build failed</div>
        <pre className="pv-build-error-msg">{buildState.message}</pre>
        {Array.isArray(buildState.details) && buildState.details.length > 0 && (
          <ul className="pv-build-error-list">
            {buildState.details.slice(0, 8).map((d, i) => (
              <li key={i}>
                {d.location?.file ? <code>{d.location.file}</code> : null}
                {d.location?.line ? `:${d.location.line}` : ""} — {d.text}
              </li>
            ))}
          </ul>
        )}
        <button className="pv-cta-btn pv-cta-primary" onClick={onRun}>
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    );
  }

  // Ready — frame the blob URL.
  return (
    <>
      <div className="pv-build-status">
        <CheckCircle size={12} />
        <span>
          Live preview · {Math.round(buildState.durationMs)} ms ·{" "}
          {(buildState.bytes / 1024).toFixed(0)} KB
        </span>
      </div>
      <div className="pv-frame-wrap" data-device={deviceId}>
        <iframe
          ref={iframeRef}
          key={`in-ide-${reloadCounter}`}
          className="pv-frame"
          src={buildState.blobUrl}
          style={device.width ? { width: device.width, maxWidth: "100%" } : undefined}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
          title="In-IDE preview"
          onLoad={onLoad}
        />
      </div>
    </>
  );
};

const LaunchStep = ({ done, title, sub, action }) => (
  <div className={`pv-launch-step ${done ? "is-done" : ""}`}>
    <span className="pv-launch-step-check">
      {done ? <CheckCircle size={13} /> : <span className="pv-launch-step-dot" />}
    </span>
    <div className="pv-launch-step-body">
      <div className="pv-launch-step-title">{title}</div>
      <div className="pv-launch-step-sub">{sub}</div>
    </div>
    {action && (
      <button type="button" className="pv-chip-action" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

const BuildStages = ({ stage }) => {
  const currentIdx = BUILD_STAGE_ORDER.indexOf(stage);
  return (
    <div className="pv-build-stages">
      {BUILD_STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={`pv-build-stage ${i < currentIdx ? "is-done" : i === currentIdx ? "is-current" : ""}`}
        >
          <span className="pv-build-stage-dot" />
          <span>{BUILD_STAGE_LABELS[s]}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * External-URL Local body — the legacy "frame http://localhost:5173" path,
 * kept as an advanced fallback.
 */
const ExternalBody = ({ url, phase, device, deviceId, reloadCounter, iframeRef, onLoad, folderPath, refresh }) => (
  <>
    <div className="pv-local-status-bar" data-phase={phase}>
      <span className="pv-status-dot" />
      <span className="pv-status-label">
        {phase === "online" && <>Dev server online at <code>{url}</code></>}
        {phase === "offline" && <>Waiting for dev server at <code>{url}</code>...</>}
        {phase === "checking" && <>Checking <code>{url}</code>...</>}
      </span>
      <button className="pv-link-btn" onClick={refresh} title="Reload preview">
        <RefreshCw size={11} /> Reload
      </button>
    </div>
    <div className="pv-frame-wrap" data-device={deviceId}>
      {phase === "online" ? (
        <iframe
          ref={iframeRef}
          key={`external-${reloadCounter}`}
          className="pv-frame"
          src={url}
          style={device.width ? { width: device.width, maxWidth: "100%" } : undefined}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
          title="External preview"
          onLoad={onLoad}
        />
      ) : (
        <LocalWaiting url={url} phase={phase} folderPath={folderPath} />
      )}
    </div>
  </>
);

const LocalWaiting = ({ url, phase, folderPath }) => (
  <div className="pv-local-waiting">
    <div className="pv-local-waiting-icon">
      {phase === "checking" ? <Loader size={22} className="pv-spin" /> : <Laptop2 size={22} />}
    </div>
    <div className="pv-local-waiting-title">
      {phase === "checking" ? "Looking for your dev server..." : "No dev server running yet"}
    </div>
    <div className="pv-local-waiting-sub">
      Run this in a terminal on your machine:
    </div>
    <code className="pv-local-waiting-cmd">
      {folderPath ? `cd ${folderPath} && ` : ""}npm install &amp;&amp; npm run dev
    </code>
    <div className="pv-local-waiting-foot">
      Or click the <Laptop2 size={11} /> icon above to switch back to the
      zero-terminal in-IDE preview.
    </div>
  </div>
);

const LocalHints = ({ detection, downloadState, onDownload }) => {
  const folderPath = detection.kind === "subfolder" ? detection.path : null;
  const folderLabel = folderPath ? `${folderPath}/` : "your frontend folder";

  return (
    <div className="pv-hints">
      <div className="pv-hint-title">
        <Sparkles size={11} /> Run locally on your machine
      </div>

      <div className="pv-hint-row">
        <div className="pv-hint-num">1</div>
        <div className="pv-hint-text">
          <strong>Download</strong> <code>{folderLabel}</code> and run{" "}
          <code>npm install &amp;&amp; npm run dev</code> for full Vite HMR
          in your own editor.
        </div>
        <button
          className="pv-cta-btn pv-cta-primary"
          onClick={onDownload}
          disabled={downloadState.kind === "loading"}
        >
          {downloadState.kind === "loading"
            ? <><Loader size={11} className="pv-spin" /> Zipping...</>
            : <><Download size={11} /> Download .zip</>}
        </button>
      </div>

      {downloadState.kind === "ok" && (
        <div className="pv-hint-success">
          <CheckCircle size={11} /> Downloaded <code>{downloadState.filename}</code> ({downloadState.fileCount} files).
        </div>
      )}
      {downloadState.kind === "error" && (
        <div className="pv-hint-error">
          <AlertCircle size={11} /> {downloadState.message}
        </div>
      )}
    </div>
  );
};

export default PreviewPanel;
