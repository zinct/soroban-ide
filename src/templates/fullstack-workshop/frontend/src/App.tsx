import { useCallback, useEffect, useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { contractId, invokeWrite, networkLabel, simulate } from "./sorobanClient";
import { useWallet } from "./wallet";
import { applyContractError, ensureConnected, logAction } from "./previewActions";

type Status =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "setup"; title: string; message: string };

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);
const DEPLOY_HINT = "Deploy contracts/counter in the Deploy panel, set VITE_CONTRACT_ID, then Rebuild preview.";

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setStatus({
        kind: "setup",
        title: "Deploy the counter contract",
        message: "Open Deploy → contracts/counter → build & deploy, then Rebuild in Preview.",
      });
      return;
    }
    if (!address) {
      setCount(null);
      setStatus({ kind: "idle" });
      return;
    }
    logAction("refresh → simulate get()");
    setStatus({ kind: "loading", label: "Reading counter" });
    try {
      const value = await simulate<number | bigint>("get", address);
      setCount(Number(value));
      setStatus({ kind: "idle" });
      logAction(`refresh ✓ counter = ${Number(value)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const next = applyContractError(message, DEPLOY_HINT, "get");
      if (next.kind === "setup") setCount(null);
      setStatus(next);
      logAction(`refresh ✗ ${message}`, "error");
    }
  }, [address]);

  useEffect(() => {
    if (!detecting) refresh();
  }, [refresh, detecting]);

  const handleConnect = async () => {
    logAction("Connect Freighter clicked");
    setStatus({ kind: "loading", label: "Connecting wallet" });
    try {
      await ensureConnected(address, connect);
      setStatus({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
      logAction(`connect ✗ ${message}`, "error");
    }
  };

  const runWrite = async (method: "increment" | "decrement" | "reset", label: string) => {
    setStatus({ kind: "loading", label });
    try {
      const wallet = await ensureConnected(address, connect);
      logAction(`${method}() → Freighter sign`);
      const next = await invokeWrite<number | bigint>(method, wallet, signTransaction);
      setCount(Number(next));
      setStatus({ kind: "ok", message: `${label} confirmed` });
      logAction(`${method}() ✓ new value ${Number(next)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const next = applyContractError(message, DEPLOY_HINT, method);
      if (next.kind === "setup") setCount(null);
      setStatus(next);
      logAction(`${method}() ✗ ${message}`, "error");
    }
  };

  const showSetup = status.kind === "setup" || !contractId;
  const setup = status.kind === "setup"
    ? status
    : !contractId
      ? { title: "Deploy the counter contract", message: "Open Deploy → contracts/counter → build & deploy." }
      : null;

  return (
    <div className="app">
      <div className="shell">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-icon">#</div>
            <div className="nav-text">
              <strong>Counter</strong>
              <span>On-chain integer state</span>
            </div>
          </div>
          <div className="nav-end">
            <span className="chip chip-live">{networkLabel}</span>
            {address ? (
              <span className="chip chip-wallet" title={address}>{short(address)}</span>
            ) : detecting ? (
              <span className="chip">Connecting…</span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleConnect}>Connect</button>
            )}
          </div>
        </nav>

        <div className="body">
          {showSetup && setup ? (
            <div className="panel panel-empty">
              <h2>{setup.title}</h2>
              <p>{setup.message}</p>
            </div>
          ) : (
            <>
              <div className="panel panel-hero">
                <span className="hero-label">Current value</span>
                <span className="hero-value">{count === null ? "—" : count.toLocaleString()}</span>
                <span className="hero-meta">Contract <code title={contractId}>{short(contractId)}</code></span>
              </div>

              <div className="btn-row">
                <button type="button" className="btn" onClick={() => runWrite("increment", "Increment")} disabled={detecting}>+1</button>
                <button type="button" className="btn" onClick={() => runWrite("decrement", "Decrement")} disabled={detecting}>−1</button>
                <button type="button" className="btn" onClick={() => runWrite("reset", "Reset")} disabled={detecting}>Reset</button>
              </div>
              <button type="button" className="btn btn-ghost btn-block" onClick={refresh} disabled={!address}>Refresh</button>

              {!address && !detecting && <p className="hint">Connect Freighter to sign increment, decrement, and reset.</p>}

              {status.kind === "loading" && <div className="alert alert-info"><span className="spinner" /> {status.label}</div>}
              {status.kind === "ok" && <div className="alert alert-ok">{status.message}</div>}
              {status.kind === "error" && <div className="alert alert-err">{status.message}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
