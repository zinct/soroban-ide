import React, { useState, useCallback, useEffect, useRef } from "react";
import { Wallet, Hammer, Rocket, CheckCircle, WarningCircle, CircleNotch, Copy, Check, Play, CaretDown, CaretRight } from "@phosphor-icons/react";
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
import { signAndSubmitWithFreighter } from "../../services/freighter";

// Dispatch a command to the Terminal panel
const runInTerminal = (cmd, files, onDone, onContractId) => {
  // Show command in terminal
  window.dispatchEvent(new CustomEvent("soroban:runCommand", { detail: { cmd, files, onDone, onContractId } }));
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    running: { icon: <CircleNotch size={11} className="spin" />, label: "Running",  cls: "badge-running" },
    success: { icon: <CheckCircle size={11} />,             label: "Success",  cls: "badge-success" },
    error:   { icon: <WarningCircle size={11} />,             label: "Failed",   cls: "badge-error"   },
  };
  const s = map[status];
  if (!s) return null;
  return <span className={`deploy-badge ${s.cls}`}>{s.icon}{s.label}</span>;
};

const Section = ({ icon, title, children, defaultOpen = true, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="deploy-section">
      <button className="deploy-section-header" onClick={() => setOpen(v => !v)}>
        {icon}<span>{title}</span>
        {badge && <span style={{ marginLeft: 8 }}>{badge}</span>}
        {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
      </button>
      {open && <div className="deploy-section-body">{children}</div>}
    </div>
  );
};

const DeployPanel = ({ treeData, fileContents }) => {
  const {
    defaultWallet, setDefaultWallet, walletLoading, setWalletLoading,
    compileStatus, setCompileStatus,
    deployStatus, setDeployStatus,
    deployedContractId, setDeployedContractId,
    contractFunctions, setContractFunctions,
  } = useDeploy();
  const { walletAddress, walletNetwork, connectWallet, disconnectWallet, error: walletConnectError } = useContract();

  const [walletError, setWalletError] = useState(null);
  const [freighterBalance, setFreighterBalance] = useState(null);
  const [alias, setAlias] = useState("my-contract");
  const [sourceAccount, setSourceAccount] = useState("default");
  const [copied, setCopied] = useState(false);
  const [invokeResults, setInvokeResults] = useState({});
  const [fnArgs, setFnArgs] = useState({});
  const [invokingFn, setInvokingFn] = useState(null);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  // Detect contract folder name
  const contractFolderName = useCallback(() => {
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.name === "contracts" && n.children) {
          const first = n.children.find(c => c.type === "folder");
          return first?.name || null;
        }
        if (n.children) { const r = walk(n.children); if (r) return r; }
      }
      return null;
    };
    return walk(treeData || []);
  }, [treeData]);

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

  const aliasEditedRef = React.useRef(false);
  useEffect(() => {
    if (aliasEditedRef.current) return;
    const name = contractFolderName();
    if (name) setAlias(name);
  }, [contractFolderName]);

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
    setCompileStatus("running");
    const files = collectProjectFiles(treeData, fileContents);
    const cmd = "stellar contract build";
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
        onError: () => { setCompileStatus("error"); cleanup?.(); },
        onDone: async () => {
          setCompileStatus("success");
          cleanup();
          try {
            const result = await getContractInterface(files);
            setContractFunctions(result.functions || []);
          } catch (_) {}
        },
        onClose: () => {},
      });
    } catch (err) {
      setCompileStatus("error");
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "error", content: err.message }
      }));
    }
  }, [treeData, fileContents]);

  // ─── Deploy → stream to Terminal ─────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (compileStatus !== "success") return;
    if (deployedContractId) {
      setShowReplaceDialog(true);
      return;
    }
    await executeDeploy();
  }, [compileStatus, deployedContractId]);

  const executeDeploy = useCallback(async () => {
    setDeployStatus("running");
    const files = collectProjectFiles(treeData, fileContents);
    const contractName = (contractFolderName() || alias).replace(/-/g, "_");
    const wasmPath = `/app/target/wasm32v1-none/release/${contractName}.wasm`;
    const useFreighter = sourceAccount === "freighter" && walletAddress;
    const sourceKey = useFreighter ? "freighter-wallet" : (defaultWallet?.name || "stellar-ide-default");
    const buildOnly = useFreighter ? " --build-only" : "";
    // Random salt prevents contract ID collision on re-deploy
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
    // Prefix alias with short session ID to avoid collisions between users on shared server key
    const sessionPrefix = getSessionId().slice(0, 8);
    const scopedAlias = `${sessionPrefix}-${alias}`;
    const cmd = `stellar contract deploy --wasm ${wasmPath} --source ${sourceKey} --network testnet --alias ${scopedAlias} --salt ${salt}${buildOnly}`;

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
        onError: () => { setDeployStatus("error"); cleanup?.(); },
        onDone: async () => {
          if (useFreighter) {
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
              const result = await signAndSubmitWithFreighter(xdr, walletAddress);
              window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                detail: { type: "output", content: "✅ Transaction submitted via Freighter!" }
              }));
              if (result?.contractId) {
                setDeployedContractId(result.contractId);
                window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                  detail: { type: "output", content: `📋 Contract ID: ${result.contractId}` }
                }));
              }
              setDeployStatus("success");
              try {
                const result2 = await getContractInterface(files);
                setContractFunctions(result2.functions || []);
              } catch (_) {}
            } catch (err) {
              window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
                detail: { type: "error", content: `❌ Freighter sign failed: ${err.message}` }
              }));
              setDeployStatus("error");
            }
          } else {
            const match = fullLog.match(/C[A-Z2-7]{55}/);
            if (match) setDeployedContractId(match[0]);
            setDeployStatus("success");
            try {
              const result = await getContractInterface(files);
              setContractFunctions(result.functions || []);
            } catch (_) {}
          }
          cleanup();
        },
        onClose: () => {},
      });
    } catch (err) {
      setDeployStatus("error");
      window.dispatchEvent(new CustomEvent("soroban:terminalAppend", {
        detail: { type: "error", content: err.message }
      }));
    }
  }, [treeData, fileContents, alias, sourceAccount, walletAddress, defaultWallet, contractFolderName]);

  // ─── Invoke → stream to Terminal ─────────────────────────────────────────

  const handleInvoke = useCallback(async (fn) => {
    if (!deployedContractId) return;
    setInvokingFn(fn.name);
    const args = fnArgs[fn.name] || {};
    const params = fn.params || [];
    const argStr = params.map(p => {
      const val = args[p.name] ?? "";
      const quoted = val.includes(" ") ? `"${val}"` : (val || '""');
      return `--${p.name} ${quoted}`;
    }).join(" ");
    const sendFlag = fn.category === "write" ? " --send=yes" : "";
    const sourceKey = defaultWallet?.name || "stellar-ide-default";
    const cmd = `stellar contract invoke --id ${deployedContractId} --source ${sourceKey} --network testnet${sendFlag} -- ${fn.name} ${argStr}`.trim();
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
        onError: () => { setInvokeResults(r => ({ ...r, [fn.name]: { error: "Failed" } })); setInvokingFn(null); cleanup?.(); },
        onDone: () => {
          const failed = out.includes("error:") || out.includes("Command failed");
          setInvokeResults(r => ({ ...r, [fn.name]: failed ? { error: out.trim() } : { output: out.trim() } }));
          setInvokingFn(null);
          cleanup();
        },
        onClose: () => {},
      });
    } catch (err) {
      setInvokeResults(r => ({ ...r, [fn.name]: { error: err.message } }));
      setInvokingFn(null);
    }
  }, [deployedContractId, fnArgs, treeData, fileContents, defaultWallet]);

  const handleCopyId = () => {
    if (deployedContractId) {
      navigator.clipboard.writeText(deployedContractId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const readFns  = contractFunctions.filter(f => f.category === "read");
  const writeFns = contractFunctions.filter(f => f.category === "write");
  const otherFns = contractFunctions.filter(f => f.category === "unknown");

  return (
    <div className="deploy-panel">
      {showReplaceDialog && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,padding:"28px 28px 24px",maxWidth:400,width:"90%"}}>
            <div style={{fontWeight:600,fontSize:15,color:"#fff",marginBottom:12,fontFamily:"monospace"}}>Replace Deployed Contract?</div>
            <div style={{color:"#999",fontSize:13,lineHeight:1.7,marginBottom:20,fontFamily:"monospace"}}>
              This will deploy a new contract and replace:<br/>
              <span style={{color:"#fff",fontSize:11,wordBreak:"break-all"}}>{deployedContractId}</span>
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
                <button className="deploy-icon-btn" onClick={() => navigator.clipboard.writeText(defaultWallet.address)}><Copy size={11} /></button>
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
                {walletLoading ? <CircleNotch size={12} className="spin" /> : <Wallet size={12} />}
                {walletLoading ? "Creating..." : "Create & Fund Account"}
              </button>
            </>
          )}
          {walletError && <div className="deploy-error">{walletError}</div>}
        </div>

        <div className="deploy-subsection">
          <div className="deploy-subsection-label">Freighter Wallet</div>
          {walletAddress ? (
            <div className="deploy-wallet-card">
              <div className="deploy-wallet-card-name">
                <span>Freighter</span>
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
                <button className="deploy-icon-btn" onClick={() => navigator.clipboard.writeText(walletAddress)}><Copy size={11} /></button>
              </div>
              {freighterBalance && (
                <div className="deploy-wallet-card-balance">
                  <span className="deploy-balance-amount">{freighterBalance}</span>
                  <span className="deploy-balance-unit">XLM</span>
                </div>
              )}
              {walletConnectError && <div className="deploy-error">{walletConnectError}</div>}
            </div>
          ) : (
            <>
              <button className="deploy-btn deploy-btn-secondary" onClick={connectWallet}>Connect Freighter</button>
              <div className="deploy-hint" style={{marginTop:4}}>
                ⚠️ Before connecting, switch Freighter to <strong>Testnet</strong>:<br/>
                Freighter → Settings → Network → Test SDF Network
              </div>
            </>
          )}
        </div>
      </Section>

      {/* ── Compile ── */}
      <Section icon={<Hammer size={14} />} title="Compile" badge={<StatusBadge status={compileStatus} />}>
        <button className="deploy-btn deploy-btn-primary" onClick={handleCompile} disabled={compileStatus === "running"}>
          {compileStatus === "running" ? <CircleNotch size={14} className="spin" /> : <Hammer size={14} />}
          {compileStatus === "running" ? "Compiling..." : "Build Contract"}
        </button>
      </Section>

      {/* ── Deploy ── */}
      <Section icon={<Rocket size={14} />} title="Deploy Contract" badge={<StatusBadge status={deployStatus} />}>
        <div className="deploy-form-group">
          <label className="deploy-label">Contract Alias</label>
          <input className="deploy-input" value={alias} onChange={e => { aliasEditedRef.current = true; setAlias(e.target.value); }} placeholder="my-contract" />
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
              <option value="freighter">Freighter — {walletAddress.slice(0,6)}…{walletAddress.slice(-4)}</option>
            )}
          </select>
        </div>

        <button
          className="deploy-btn deploy-btn-primary"
          onClick={handleDeploy}
          disabled={compileStatus !== "success" || deployStatus === "running"}
        >
          {deployStatus === "running" ? <CircleNotch size={14} className="spin" /> : <Rocket size={14} />}
          {deployStatus === "running" ? "Deploying..." : "Deploy"}
        </button>
        {compileStatus !== "success" && <div className="deploy-hint">Build must succeed first.</div>}
      </Section>

      {/* ── Deployed Contract ── */}
      <Section icon={<CheckCircle size={14} />} title="Deployed Contract" defaultOpen={!!deployedContractId}>
        {deployedContractId ? (
          <>
            <div className="deploy-contract-id-row">
              <span className="deploy-contract-id" title={deployedContractId}>
                {deployedContractId.slice(0,8)}…{deployedContractId.slice(-8)}
              </span>
              <button className="deploy-icon-btn" onClick={handleCopyId} title={deployedContractId}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            {contractFunctions.length > 0 ? (
              <div className="deploy-functions">
                {readFns.length > 0 && (
                  <div className="deploy-fn-group">
                    <div className="deploy-fn-group-label read">Read-only</div>
                    {readFns.map(fn => <FnCard key={fn.name} fn={fn} fnArgs={fnArgs} setFnArgs={setFnArgs} onInvoke={handleInvoke} invoking={invokingFn === fn.name} result={invokeResults[fn.name]} />)}
                  </div>
                )}
                {writeFns.length > 0 && (
                  <div className="deploy-fn-group">
                    <div className="deploy-fn-group-label write">Write</div>
                    {writeFns.map(fn => <FnCard key={fn.name} fn={fn} fnArgs={fnArgs} setFnArgs={setFnArgs} onInvoke={handleInvoke} invoking={invokingFn === fn.name} result={invokeResults[fn.name]} />)}
                  </div>
                )}
                {otherFns.length > 0 && (
                  <div className="deploy-fn-group">
                    <div className="deploy-fn-group-label unknown">Functions</div>
                    {otherFns.map(fn => <FnCard key={fn.name} fn={fn} fnArgs={fnArgs} setFnArgs={setFnArgs} onInvoke={handleInvoke} invoking={invokingFn === fn.name} result={invokeResults[fn.name]} />)}
                  </div>
                )}
              </div>
            ) : (
              <div className="deploy-hint">Build the contract to load its interface.</div>
            )}
          </>
        ) : (
          <div className="deploy-hint">Deploy a contract to interact with it here.</div>
        )}
      </Section>
    </div>
  );
};

const FnCard = ({ fn, fnArgs, setFnArgs, onInvoke, invoking, result }) => {
  const args = fnArgs[fn.name] || {};
  const params = fn.params || [];

  // Extract the actual result value — last non-empty line that isn't an info/error prefix
  const resultValue = result?.output
    ? result.output.split("\n").filter(l => l.trim() && !l.startsWith("ℹ") && !l.startsWith("❌") && !l.startsWith("✅")).pop()?.trim()
    : null;

  return (
    <div className="deploy-fn-card">
      <div className="deploy-fn-name">fn {fn.name}()</div>
      {params.map(p => (
        <div key={p.name} className="deploy-form-group">
          <label className="deploy-label">{p.name}: <span className="deploy-type">{p.type}</span></label>
          <input
            className="deploy-input"
            placeholder={p.type}
            value={args[p.name] || ""}
            onChange={e => setFnArgs(prev => ({ ...prev, [fn.name]: { ...prev[fn.name], [p.name]: e.target.value } }))}
          />
        </div>
      ))}
      <button className="deploy-btn deploy-btn-invoke" onClick={() => onInvoke(fn)} disabled={invoking}>
        {invoking ? <CircleNotch size={11} className="spin" /> : <Play size={11} />}
        {invoking ? "Calling…" : "Call"}
      </button>
      {result?.error && <pre className="deploy-fn-result error">{result.error}</pre>}
      {!result?.error && resultValue && <pre className="deploy-fn-result success">{resultValue}</pre>}
    </div>
  );
};

export default DeployPanel;
