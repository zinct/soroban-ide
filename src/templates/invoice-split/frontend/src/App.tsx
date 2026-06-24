import { useCallback, useEffect, useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { contractId, invokeWrite, networkLabel, simulate } from "./sorobanClient";
import { useWallet } from "./wallet";
import { applyContractError, ensureConnected, logAction } from "./previewActions";

type SplitStatus = { bill_total: number; paid_total: number };
type Status =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "setup"; title: string; message: string };

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);
const DEPLOY_HINT = "Deploy contracts/invoice_split, build WASM, deploy, then Rebuild preview.";
const RING = 2 * Math.PI * 54;

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [split, setSplit] = useState<SplitStatus | null>(null);
  const [billTotal, setBillTotal] = useState("120");
  const [shareAmount, setShareAmount] = useState("40");
  const [ui, setUi] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setUi({ kind: "setup", title: "Deploy Split Bill", message: DEPLOY_HINT });
      return;
    }
    if (!address) {
      setSplit(null);
      setUi({ kind: "idle" });
      return;
    }
    logAction("refresh → simulate get_status()");
    setUi({ kind: "loading", label: "Loading" });
    try {
      const data = await simulate<SplitStatus>("get_status", address);
      setSplit({ bill_total: Number(data.bill_total), paid_total: Number(data.paid_total) });
      setUi({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi(applyContractError(message, DEPLOY_HINT, "get_status"));
      logAction(`refresh ✗ ${message}`, "error");
    }
  }, [address]);

  useEffect(() => {
    if (!detecting) refresh();
  }, [refresh, detecting]);

  const runWrite = async (method: string, label: string, args: unknown[]) => {
    const argLabel = `${method}(${args.join(", ")})`;
    setUi({ kind: "loading", label });
    try {
      const wallet = await ensureConnected(address, connect);
      logAction(`${argLabel} → Freighter sign`);
      await invokeWrite(method, wallet, signTransaction, args);
      setUi({ kind: "ok", message: `${label} saved` });
      logAction(`${argLabel} ✓ confirmed`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUi(applyContractError(message, DEPLOY_HINT, method));
      logAction(`${argLabel} ✗ ${message}`, "error");
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

  const bill = split?.bill_total ?? 0;
  const paid = split?.paid_total ?? 0;
  const remaining = Math.max(0, bill - paid);
  const pct = bill > 0 ? Math.min(100, Math.round((paid / bill) * 100)) : 0;
  const dashOffset = RING * (1 - pct / 100);

  return (
    <div className="app">
      <div className="shell">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-icon">S</div>
            <div className="nav-text">
              <strong>Split Bill</strong>
              <span>Share group expenses</span>
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
              <h2>{ui.kind === "setup" ? ui.title : "Deploy Split Bill"}</h2>
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
                    <strong>{pct}%</strong>
                    <span>collected</span>
                  </div>
                </div>
                <div className="stat-grid">
                  <div className="stat-item"><strong>{bill || "—"}</strong><span>Bill</span></div>
                  <div className="stat-item"><strong>{paid}</strong><span>Paid</span></div>
                </div>
                <p className="hero-meta">Remaining: <strong style={{ color: "var(--text)" }}>{remaining}</strong></p>
              </div>

              <div className="panel">
                <label className="field-label" htmlFor="bill">Bill total</label>
                <input id="bill" className="field" type="number" min={1} value={billTotal} onChange={(e) => setBillTotal(e.target.value)} />
                <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => runWrite("set_bill", "Bill updated", [parseInt(billTotal, 10) || 0])} disabled={detecting}>
                  Set bill
                </button>

                <div className="divider" style={{ margin: "16px 0" }} />

                <label className="field-label" htmlFor="share">Your payment</label>
                <div className="input-inline">
                  <input id="share" className="field" type="number" min={1} value={shareAmount} onChange={(e) => setShareAmount(e.target.value)} />
                  <button type="button" className="btn btn-primary" onClick={() => runWrite("pay_share", "Payment recorded", [parseInt(shareAmount, 10) || 0])} disabled={detecting}>
                    Pay
                  </button>
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
