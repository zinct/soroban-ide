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
const DEPLOY_HINT = "Deploy contracts/donation_vault, build WASM, deploy, then Rebuild preview.";
const CHIPS = [10, 25, 50];
const GOAL = 500;

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [total, setTotal] = useState<number | null>(null);
  const [donors, setDonors] = useState<number | null>(null);
  const [amount, setAmount] = useState("25");
  const [ui, setUi] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setUi({ kind: "setup", title: "Deploy Donation Vault", message: DEPLOY_HINT });
      return;
    }
    if (!address) {
      setTotal(null);
      setUi({ kind: "idle" });
      return;
    }
    logAction("refresh → simulate get_total(), get_donor_count()");
    setUi({ kind: "loading", label: "Loading" });
    try {
      const [t, d] = await Promise.all([
        simulate<number | bigint>("get_total", address),
        simulate<number | bigint>("get_donor_count", address),
      ]);
      setTotal(Number(t));
      setDonors(Number(d));
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

  const donate = async () => {
    const value = Math.max(1, parseInt(amount, 10) || 0);
    setUi({ kind: "loading", label: "Recording donation" });
    try {
      const wallet = await ensureConnected(address, connect);
      logAction(`donate(${value}) → Freighter sign`);
      await invokeWrite("donate", wallet, signTransaction, [value]);
      setUi({ kind: "ok", message: `Thank you — ${value} recorded on-chain` });
      logAction(`donate(${value}) ✓ confirmed`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi(applyContractError(message, DEPLOY_HINT, "donate"));
      logAction(`donate(${value}) ✗ ${message}`, "error");
    }
  };

  const handleConnect = async () => {
    logAction("Connect to donate clicked");
    try {
      await ensureConnected(address, connect);
      await refresh();
    } catch (err) {
      setUi({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const raised = total ?? 0;
  const goalPct = Math.min(100, Math.round((raised / GOAL) * 100));

  return (
    <div className="app">
      <div className="shell">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-icon">D</div>
            <div className="nav-text">
              <strong>Donation Vault</strong>
              <span>Transparent giving</span>
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
              <h2>{ui.kind === "setup" ? ui.title : "Deploy Donation Vault"}</h2>
              <p>{ui.kind === "setup" ? ui.message : DEPLOY_HINT}</p>
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="progress-head">
                  <span className="field-label" style={{ margin: 0 }}>{raised.toLocaleString()} raised</span>
                  <span className="hero-meta" style={{ margin: 0 }}>{goalPct}% of {GOAL} goal</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${goalPct}%` }} /></div>
                <div className="stat-grid">
                  <div className="stat-item"><strong>{total === null ? "—" : total.toLocaleString()}</strong><span>Total</span></div>
                  <div className="stat-item"><strong>{donors ?? 0}</strong><span>Donors</span></div>
                </div>
              </div>

              <div className="panel">
                <span className="field-label">Donation amount</span>
                <div className="preset-grid preset-grid-3">
                  {CHIPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`preset${Number(amount) === n ? " on" : ""}`}
                      onClick={() => { logAction(`donation preset ${n}`); setAmount(String(n)); }}
                      disabled={detecting}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input className="field" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom amount" />
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={donate} disabled={detecting}>Donate</button>
                <button type="button" className="btn btn-ghost btn-block" onClick={refresh} disabled={!address}>Refresh</button>
                <p className="hero-meta" style={{ marginTop: 12, textAlign: "center" }}>Vault <code title={contractId}>{short(contractId)}</code></p>
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
