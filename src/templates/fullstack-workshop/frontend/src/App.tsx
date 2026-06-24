import { useCallback, useEffect, useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import {
  contractId,
  invokeWrite,
  networkLabel,
  simulate,
} from "./sorobanClient";
import { useWallet } from "./wallet";

type Status =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "setup"; title: string; message: string };

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

const isWrongContractMessage = (message: string) =>
  /does not have a "get" function|non-existent contract function|MissingValue/i.test(message);

const SetupCard = ({ title, message }: { title: string; message: string }) => (
  <div className="empty-card">
    <div className="empty-title">{title}</div>
    <div className="empty-sub">{message}</div>
  </div>
);

const App = () => {
  const { address, detecting, connect } = useWallet();
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!contractId) {
      setStatus({
        kind: "setup",
        title: "Deploy the counter contract",
        message: "Open the Deploy panel in Soroban IDE, select contracts/counter, build, and deploy. Then click Rebuild in Preview.",
      });
      return;
    }
    if (!address) {
      setCount(null);
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "loading", label: "Reading counter" });
    try {
      const value = await simulate<number | bigint>("get", address);
      setCount(Number(value));
      setStatus({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isWrongContractMessage(message)) {
        setStatus({
          kind: "setup",
          title: "Wrong contract linked",
          message: "The preview is pointing at a contract without a get function. In Deploy, select contracts/counter, build, deploy, then Rebuild in Preview.",
        });
        setCount(null);
        return;
      }
      setStatus({ kind: "error", message });
    }
  }, [address]);

  useEffect(() => {
    if (!detecting) refresh();
  }, [refresh, detecting]);

  const handleConnect = async () => {
    setStatus({ kind: "loading", label: "Connecting Freighter" });
    try {
      await connect();
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const runWrite = async (method: "increment" | "decrement" | "reset", label: string) => {
    if (!address) return;
    setStatus({ kind: "loading", label });
    try {
      const next = await invokeWrite<number | bigint>(method, address, signTransaction);
      setCount(Number(next));
      setStatus({ kind: "ok", message: `${label} confirmed` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isWrongContractMessage(message)) {
        setStatus({
          kind: "setup",
          title: "Wrong contract linked",
          message: "Deploy contracts/counter from the Deploy panel, then Rebuild in Preview.",
        });
        return;
      }
      setStatus({ kind: "error", message });
    }
  };

  const showSetup = status.kind === "setup" || !contractId;
  const setup = status.kind === "setup"
    ? status
    : !contractId
      ? {
          title: "Deploy the counter contract",
          message: "Open the Deploy panel in Soroban IDE, select contracts/counter, build, and deploy. Then click Rebuild in Preview.",
        }
      : null;

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <span className="logo">★</span>
          <span>Soroban Counter</span>
        </div>
        <div className="header-actions">
          <span className="network-pill">{networkLabel}</span>
          {address ? (
            <span className="wallet-pill" title={address}>
              <span className="dot" /> {short(address)}
            </span>
          ) : detecting ? (
            <span className="wallet-pill wallet-pill-detecting">Detecting wallet…</span>
          ) : (
            <button className="btn btn-primary" onClick={handleConnect}>
              Connect Freighter
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {showSetup && setup ? (
          <SetupCard title={setup.title} message={setup.message} />
        ) : (
          <>
            <section className="count-card">
              <div className="count-label">Current value</div>
              <div className="count-value">{count === null ? "—" : count.toLocaleString()}</div>
              <div className="count-id" title={contractId}>
                <code>{short(contractId)}</code>
              </div>
            </section>

            <section className="actions">
              <button className="btn btn-large" onClick={() => runWrite("increment", "Incrementing")} disabled={!address}>
                +1 Increment
              </button>
              <button className="btn btn-large" onClick={() => runWrite("decrement", "Decrementing")} disabled={!address}>
                −1 Decrement
              </button>
              <button className="btn btn-ghost btn-large" onClick={() => runWrite("reset", "Resetting")} disabled={!address}>
                Reset to 0
              </button>
              <button className="btn btn-ghost" onClick={refresh} disabled={!address}>
                Refresh
              </button>
            </section>

            {!address && !detecting && (
              <p className="hint">
                Connect Freighter in the Deploy panel or click <strong>Connect Freighter</strong> above.
                Write actions (increment, etc.) open the Freighter popup to sign.
              </p>
            )}

            {status.kind === "loading" && (
              <div className="status status-loading">
                <span className="spinner" /> {status.label}…
              </div>
            )}
            {status.kind === "ok" && <div className="status status-ok">{status.message}</div>}
            {status.kind === "error" && (
              <div className="status status-error">{status.message}</div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        Built in Soroban IDE · in-browser preview
      </footer>
    </div>
  );
};

export default App;
