import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  loadHistory,
  saveHistory,
  addDeployment as addDeploymentPure,
  removeDeployment as removeDeploymentPure,
  clearGroup as clearGroupPure,
  promoteToActive as promoteToActivePure,
  togglePinned as togglePinnedPure,
} from "../features/deploy/deploymentHistory";

const DeployContext = createContext(null);

const STORAGE_KEY = "soroban_deploy_state";

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
};

// Transient statuses like "running" must never be restored on reload —
// the backend job that flipped the status to "running" is long gone once
// the page reloads, so we'd be stuck forever waiting for a completion event
// that can't arrive.
const sanitizeStatus = (s) => (s === "running" ? null : s || null);

export const DeployProvider = ({ children }) => {
  const saved = load();

  const [defaultWallet, setDefaultWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [compileStatus, setCompileStatus] = useState(sanitizeStatus(saved.compileStatus));
  const [deployStatus, setDeployStatus] = useState(sanitizeStatus(saved.deployStatus));
  const [validationResult, setValidationResult] = useState(null);

  // Multi-contract deployment history. Shape: { [contractPath]: DeploymentRecord[] }
  // Persisted under its own localStorage key (deploymentHistory.js owns it)
  // so we can evolve the schema independently of the rest of deploy state.
  const [deploymentHistory, setDeploymentHistory] = useState(() => loadHistory());

  // Persist compile/deploy status whenever it changes. Deliberately writes
  // null in place of "running" so an interrupted build (runner restart, tab
  // close) doesn't leave the panel wedged in the RUNNING badge forever.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      compileStatus: compileStatus === "running" ? null : compileStatus,
      deployStatus: deployStatus === "running" ? null : deployStatus,
    }));
  }, [compileStatus, deployStatus]);

  // Persist history separately from the transient build status.
  useEffect(() => {
    saveHistory(deploymentHistory);
  }, [deploymentHistory]);

  const addDeployment = useCallback((record) => {
    setDeploymentHistory((h) => addDeploymentPure(h, record));
  }, []);

  const removeDeployment = useCallback((path, id) => {
    setDeploymentHistory((h) => removeDeploymentPure(h, path, id));
  }, []);

  const clearGroup = useCallback((path) => {
    setDeploymentHistory((h) => clearGroupPure(h, path));
  }, []);

  const clearAllHistory = useCallback(() => {
    setDeploymentHistory({});
  }, []);

  const promoteToActive = useCallback((path, id) => {
    setDeploymentHistory((h) => promoteToActivePure(h, path, id));
  }, []);

  const togglePinned = useCallback((path, id) => {
    setDeploymentHistory((h) => togglePinnedPure(h, path, id));
  }, []);

  const resetDeploy = useCallback(() => {
    setCompileStatus(null);
    setDeployStatus(null);
  }, []);

  return (
    <DeployContext.Provider value={{
      defaultWallet, setDefaultWallet, walletLoading, setWalletLoading,
      compileStatus, setCompileStatus,
      deployStatus, setDeployStatus,
      validationResult, setValidationResult,
      deploymentHistory,
      addDeployment, removeDeployment, clearGroup, clearAllHistory, promoteToActive, togglePinned,
      resetDeploy,
    }}>
      {children}
    </DeployContext.Provider>
  );
};

export const useDeploy = () => {
  const ctx = useContext(DeployContext);
  if (!ctx) throw new Error("useDeploy must be used within DeployProvider");
  return ctx;
};
