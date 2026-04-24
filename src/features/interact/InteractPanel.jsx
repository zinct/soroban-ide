import React, { useState } from "react";
import { useContract } from "../../context/ContractContext";
import { X, Play, Copy, Check, Wallet, WarningCircle } from "@phosphor-icons/react";

const InteractPanel = () => {
  const { contractId, walletAddress, connectWallet, setIsInteractActive } = useContract();
  const [copied, setCopied] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [args, setArgs] = useState({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);

  // Mock functions for the initial version
  const mockFunctions = [
    { name: "hello", params: ["to"] },
    { name: "increment", params: [] },
    { name: "get_count", params: [] },
  ];

  const handleCopy = () => {
    if (contractId) {
      navigator.clipboard.writeText(contractId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExecute = async () => {
    if (!walletAddress) return;
    setExecuting(true);
    setResult(null);
    
    // Simulating execution
    setTimeout(() => {
      setExecuting(false);
      setResult({ status: "success", data: "Executed successfully (Simulation)" });
    }, 1500);
  };

  return (
    <div className="interact-full-overlay">
      <div className="interact-container">
        {/* Header */}
        <div className="interact-header">
          <div className="interact-title-wrapper">
            <h2>Contract Interaction</h2>
            <div className={`contract-pill ${contractId ? "active" : ""}`} onClick={handleCopy}>
              <span className="pill-label">Contract ID:</span>
              <span className="pill-value">{contractId || "Not Deployed"}</span>
              {contractId && (copied ? <Check size={14} /> : <Copy size={14} />)}
            </div>
          </div>
          <button className="interact-close-btn" onClick={() => setIsInteractActive(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="interact-main">
          {/* Sidebar: Functions List */}
          <div className="interact-functions-sidebar">
            <div className="sidebar-section-title">Functions</div>
            <div className="functions-list">
              {mockFunctions.map((fn) => (
                <button
                  key={fn.name}
                  className={`function-item ${selectedFunction?.name === fn.name ? "active" : ""}`}
                  onClick={() => setSelectedFunction(fn)}
                >
                  <Play size={14} />
                  <span>{fn.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content: Interaction Form */}
          <div className="interact-content">
            {selectedFunction ? (
              <div className="interaction-form">
                <div className="form-header">
                  <h3>fn {selectedFunction.name}()</h3>
                  <p>Execute this function on the Soroban network.</p>
                </div>

                <div className="form-body">
                  {selectedFunction.params.length > 0 ? (
                    selectedFunction.params.map((param) => (
                      <div key={param} className="form-group">
                        <label>{param}</label>
                        <input
                          type="text"
                          className="interact-input"
                          placeholder={`Enter ${param}...`}
                          autoComplete="off"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="no-params-msg">This function takes no arguments.</div>
                  )}
                </div>

                <div className="form-actions">
                  {!walletAddress ? (
                    <div className="wallet-warning">
                      <WarningCircle size={18} />
                      <span>Wallet not connected. Connect Freighter to execute.</span>
                      <button className="btn btn-primary" onClick={connectWallet} style={{ marginLeft: "auto" }}>
                        <Wallet size={16} />
                        Connect
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-primary btn-lg btn-block" 
                      disabled={executing || !contractId}
                      onClick={handleExecute}
                    >
                      {executing ? (
                        <div className="loading-spinner small" style={{ borderColor: "currentColor", borderTopColor: "transparent" }} />
                      ) : (
                        <Play size={16} />
                      )}
                      <span>{executing ? "Executing..." : "Call Function"}</span>
                    </button>
                  )}
                </div>

                {result && (
                  <div className={`execution-result ${result.status}`}>
                    <div className="result-header">Result Output</div>
                    <pre>{JSON.stringify(result.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="interact-empty-state">
                <div className="empty-icon">
                  <Play size={48} />
                </div>
                <h3>Select a Function</h3>
                <p>Choose a function from the list on the left to start interacting with your contract.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractPanel;
