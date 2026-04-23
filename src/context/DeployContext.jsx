import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const DeployContext = createContext(null);

const STORAGE_KEY = "soroban_deploy_state";

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
};

export const DeployProvider = ({ children }) => {
  const saved = load();

  const [defaultWallet, setDefaultWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [compileStatus, setCompileStatus] = useState(saved.compileStatus || null);
  const [deployStatus, setDeployStatus] = useState(saved.deployStatus || null);
  const [deployedContractId, setDeployedContractId] = useState(saved.deployedContractId || null);
  const [contractFunctions, setContractFunctions] = useState(saved.contractFunctions || []);
  const [validationResult, setValidationResult] = useState(null);

  // Persist whenever key state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      compileStatus,
      deployStatus,
      deployedContractId,
      contractFunctions,
    }));
  }, [compileStatus, deployStatus, deployedContractId, contractFunctions]);

  const resetDeploy = useCallback(() => {
    setCompileStatus(null);
    setDeployStatus(null);
    setDeployedContractId(null);
    setContractFunctions([]);
  }, []);

  return (
    <DeployContext.Provider value={{
      defaultWallet, setDefaultWallet, walletLoading, setWalletLoading,
      compileStatus, setCompileStatus,
      deployStatus, setDeployStatus,
      deployedContractId, setDeployedContractId,
      contractFunctions, setContractFunctions,
      validationResult, setValidationResult,
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
