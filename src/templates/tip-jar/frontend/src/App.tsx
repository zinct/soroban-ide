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
const DEPLOY_HINT = "Deploy contracts/tip_jar, build WASM, deploy, then Rebuild preview.";
const PRESETS = [1, 5, 10, 25];

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [total, setTotal] = useState<number | null>(null);
  const [tipCount, setTipCount] = useState<number | null>(null);
  const [tipAmount, setTipAmount] = useState("5");
  const [ui, setUi] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setUi({ kind: "setup", title: "Deploy Tip Jar", message: DEPLOY_HINT });
      return;
    }
    if (!address) {
      setTotal(null);
      setUi({ kind: "idle" });
      return;
    }
    logAction("refresh → simulate get_total(), get_tip_count()");
    setUi({ kind: "loading", label: "Loading" });
    try {
      const [t, c] = await Promise.all([
        simulate<number | bigint>("get_total", address),
        simulate<number | bigint>("get_tip_count", address),
      ]);
      setTotal(Number(t));
      setTipCount(Number(c));
      setUi({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi(applyContractError(message, DEPLOY_HINT, "get_total"));
      logAction(`refresh ✗ ${message}`, "error");
    }
  }, [address]);

  useEffect(() => {
    if (!detecting) refresh();
  }, [refresh, detecting]);

  const sendTip = async (amount: number) => {
    setUi({ kind: "loading", label: "Sending tip" });
    try {
      const wallet = await ensureConnected(address, connect);
      logAction(`tip(${amount}) → Freighter sign`);
      await invokeWrite("tip", wallet, signTransaction, [amount]);
      setUi({ kind: "ok", message: `Thanks — ${amount} added to the jar` });
      logAction(`tip(${amount}) ✓ confirmed`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi(applyContractError(message, DEPLOY_HINT, "tip"));
      logAction(`tip(${amount}) ✗ ${message}`, "error");
    }
  };

  const handleConnect = async () => {
    logAction("Connect clicked");
    try {
      await ensureConnected(address, connect);
      await refresh();
    } catch (err) {
      setUi({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="app">
      <div className="shell">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-icon">T</div>
            <div className="nav-text">
              <strong>Tip Jar</strong>
              <span>Support this creator</span>
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
              <h2>{ui.kind === "setup" ? ui.title : "Deploy Tip Jar"}</h2>
              <p>{ui.kind === "setup" ? ui.message : DEPLOY_HINT}</p>
            </div>
          ) : (
            <>
              <div className="panel panel-hero">
                <span className="hero-label">Total received</span>
                <span className="hero-value">{total === null ? "—" : total.toLocaleString()}</span>
                <span className="hero-meta">{tipCount ?? 0} supporters</span>
              </div>

              <div className="panel">
                <span className="field-label">Choose amount</span>
                <div className="preset-grid">
                  {PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`preset${Number(tipAmount) === n ? " on" : ""}`}
                      onClick={() => { logAction(`preset tip ${n}`); setTipAmount(String(n)); }}
                      disabled={detecting}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="field-label" htmlFor="tip-amt">Or enter custom</label>
                <input id="tip-amt" className="field" type="number" min={1} value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} />
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => sendTip(Math.max(1, parseInt(tipAmount, 10) || 0))} disabled={detecting}>
                  Send tip
                </button>
                <button type="button" className="btn btn-ghost btn-block" onClick={refresh} disabled={!address}>Refresh</button>
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
