import { useCallback, useEffect, useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { contractId, invokeWrite, networkLabel, simulate } from "./sorobanClient";
import { useWallet } from "./wallet";
import { ensureConnected, logAction } from "./previewActions";

type EscrowStatus = { funded: number; released: boolean };
type Status =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "setup"; title: string; message: string };

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);
const DEPLOY_HINT = "Deploy contracts/escrow, build WASM, deploy, then Rebuild preview.";
const STEPS = ["Fund", "Hold", "Release"];

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [escrow, setEscrow] = useState<EscrowStatus | null>(null);
  const [fundAmount, setFundAmount] = useState("100");
  const [ui, setUi] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setUi({ kind: "setup", title: "Deploy Pay Escrow", message: DEPLOY_HINT });
      return;
    }
    if (!address) {
      setEscrow(null);
      setUi({ kind: "idle" });
      return;
    }
    logAction("refresh → simulate get()");
    setUi({ kind: "loading", label: "Syncing escrow" });
    try {
      const data = await simulate<EscrowStatus>("get", address);
      setEscrow({ funded: Number(data.funded), released: Boolean(data.released) });
      setUi({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi({ kind: "error", message });
      logAction(`refresh ✗ ${message}`, "error");
    }
  }, [address]);

  useEffect(() => {
    if (!detecting) refresh();
  }, [refresh, detecting]);

  const runWrite = async (method: string, label: string, args: unknown[] = []) => {
    const argLabel = args.length ? `${method}(${args.join(", ")})` : `${method}()`;
    setUi({ kind: "loading", label });
    try {
      const wallet = await ensureConnected(address, connect);
      logAction(`${argLabel} → Freighter sign`);
      await invokeWrite(method, wallet, signTransaction, args);
      setUi({ kind: "ok", message: `${label} confirmed` });
      logAction(`${argLabel} ✓ confirmed`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi({ kind: "error", message });
      logAction(`${argLabel} ✗ ${message}`, "error");
    }
  };

  const handleConnect = async () => {
    logAction("Connect wallet clicked");
    setUi({ kind: "loading", label: "Connecting" });
    try {
      await ensureConnected(address, connect);
      setUi({ kind: "idle" });
      await refresh();
    } catch (err) {
      setUi({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const step = escrow?.released ? 3 : (escrow?.funded ?? 0) > 0 ? 2 : 1;

  return (
    <div className="app">
      <div className="shell">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-icon">E</div>
            <div className="nav-text">
              <strong>Pay Escrow</strong>
              <span>Milestone payments</span>
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
          {ui.kind === "setup" || !contractId ? (
            <div className="panel panel-empty">
              <h2>{ui.kind === "setup" ? ui.title : "Deploy Pay Escrow"}</h2>
              <p>{ui.kind === "setup" ? ui.message : DEPLOY_HINT}</p>
            </div>
          ) : (
            <>
              <div className="steps">
                {STEPS.map((label, i) => {
                  const n = i + 1;
                  const state = step > n ? "done" : step === n ? "on" : "";
                  return (
                    <div key={label} className={`step ${state}`}>
                      <div className="step-dot">{step > n ? "✓" : n}</div>
                      {label}
                    </div>
                  );
                })}
              </div>

              <div className="panel panel-hero">
                <span className="hero-label">Escrow balance</span>
                <span className="hero-value">{escrow ? escrow.funded.toLocaleString() : "—"}</span>
                <span className={`badge ${escrow?.released ? "badge-ok" : "badge-warn"}`} style={{ marginTop: 14 }}>
                  {escrow?.released ? "Released" : "In escrow"}
                </span>
              </div>

              <div className="panel">
                <label className="field-label" htmlFor="fund-amt">Amount to fund</label>
                <input id="fund-amt" className="field" type="number" min={1} value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} disabled={escrow?.released} />
                <div className="btn-stack" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-primary btn-block" onClick={() => runWrite("fund", "Fund", [Math.max(1, parseInt(fundAmount, 10) || 0)])} disabled={detecting || escrow?.released}>
                    Fund escrow
                  </button>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => runWrite("release", "Release")} disabled={detecting || !escrow || escrow.funded === 0 || escrow.released}>
                    Release to freelancer
                  </button>
                  <button type="button" className="btn btn-ghost btn-block" onClick={refresh} disabled={!address}>Refresh</button>
                </div>
              </div>

              {ui.kind === "loading" && <div className="alert alert-info"><span className="spinner" /> {ui.label}</div>}
              {ui.kind === "ok" && <div className="alert alert-ok">{ui.message}</div>}
              {ui.kind === "error" && <div className="alert alert-err">{ui.message}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
