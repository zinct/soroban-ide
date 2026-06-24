import { useCallback, useEffect, useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { contractId, invokeWrite, networkLabel, simulate } from "./sorobanClient";
import { useWallet } from "./wallet";
import { ensureConnected, logAction } from "./previewActions";

type Status =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "setup"; title: string; message: string };

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);
const DEPLOY_HINT = "Deploy contracts/savings_circle, build WASM, deploy, then Rebuild preview.";
const RING = 2 * Math.PI * 54;
const QUICK = [10, 20, 50];
const GOAL = 200;

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [total, setTotal] = useState<number | null>(null);
  const [contributions, setContributions] = useState<number | null>(null);
  const [amount, setAmount] = useState("20");
  const [ui, setUi] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setUi({ kind: "setup", title: "Deploy Savings Circle", message: DEPLOY_HINT });
      return;
    }
    if (!address) {
      setTotal(null);
      setUi({ kind: "idle" });
      return;
    }
    logAction("refresh → simulate get_total(), get_contribution_count()");
    setUi({ kind: "loading", label: "Loading" });
    try {
      const [t, c] = await Promise.all([
        simulate<number | bigint>("get_total", address),
        simulate<number | bigint>("get_contribution_count", address),
      ]);
      setTotal(Number(t));
      setContributions(Number(c));
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

  const contribute = async () => {
    const value = Math.max(1, parseInt(amount, 10) || 0);
    setUi({ kind: "loading", label: "Contributing" });
    try {
      const wallet = await ensureConnected(address, connect);
      logAction(`contribute(${value}) → Freighter sign`);
      await invokeWrite("contribute", wallet, signTransaction, [value]);
      setUi({ kind: "ok", message: `Contributed ${value} to the pool` });
      logAction(`contribute(${value}) ✓ confirmed`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi({ kind: "error", message });
      logAction(`contribute(${value}) ✗ ${message}`, "error");
    }
  };

  const handleConnect = async () => {
    logAction("Join circle → connect wallet");
    try {
      await ensureConnected(address, connect);
      await refresh();
    } catch (err) {
      setUi({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const pool = total ?? 0;
  const progress = Math.min(1, pool / GOAL);
  const dashOffset = RING * (1 - progress);

  return (
    <div className="app">
      <div className="shell">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-icon">C</div>
            <div className="nav-text">
              <strong>Savings Circle</strong>
              <span>Save together</span>
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
              <h2>{ui.kind === "setup" ? ui.title : "Deploy Savings Circle"}</h2>
              <p>{ui.kind === "setup" ? ui.message : DEPLOY_HINT}</p>
            </div>
          ) : (
            <>
              <div className="panel panel-hero">
                <div className="ring-wrap">
                  <svg viewBox="0 0 120 120">
                    <circle className="ring-bg" cx="60" cy="60" r="54" />
                    <circle className="ring-fill" cx="60" cy="60" r="54" strokeDasharray={RING} strokeDashoffset={dashOffset} />
                  </svg>
                  <div className="ring-center">
                    <strong>{total === null ? "—" : total.toLocaleString()}</strong>
                    <span>{Math.round(progress * 100)}% of {GOAL}</span>
                  </div>
                </div>
                <span className="hero-meta">{contributions ?? 0} contributions</span>
              </div>

              <div className="panel">
                <span className="field-label">Quick amounts</span>
                <div className="preset-grid preset-grid-3">
                  {QUICK.map((n) => (
                    <button key={n} type="button" className={`preset${Number(amount) === n ? " on" : ""}`} onClick={() => setAmount(String(n))}>{n}</button>
                  ))}
                </div>
                <label className="field-label" htmlFor="contrib">Amount</label>
                <div className="input-inline">
                  <input id="contrib" className="field" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <button type="button" className="btn btn-primary" onClick={contribute} disabled={detecting}>Contribute</button>
                </div>
                <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={refresh} disabled={!address}>Refresh</button>
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
