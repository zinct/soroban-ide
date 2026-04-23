import React, { createContext, useContext, useState, useCallback } from "react";

const DeployContext = createContext(null);

export const DeployProvider = ({ children }) => {
  const [defaultWallet, setDefaultWallet] = useState(null); // WalletStatusResponse
  const [walletLoading, setWalletLoading] = useState(false);

  const [compileStatus, setCompileStatus] = useState(null); // null | "running" | "success" | "error"
  const [deployStatus, setDeployStatus] = useState(null);   // null | "running" | "success" | "error"
  const [deployedContractId, setDeployedContractId] = useState(null);

  const [contractFunctions, setContractFunctions] = useState([]); // ContractFn[]
  const [validationResult, setValidationResult] = useState(null); // ValidateResponse

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
