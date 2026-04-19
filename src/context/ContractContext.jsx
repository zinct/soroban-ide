import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { isFreighterConnected, getFreighterAddress } from "../services/freighter";

const ContractContext = createContext(null);

export const ContractProvider = ({ children }) => {
  const [contractId, setContractId] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [isInteractActive, setIsInteractActive] = useState(false);
  const [error, setError] = useState(null);

  // Check if Freighter is connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (await isFreighterConnected()) {
          const { address } = await getFreighterAddress();
          if (address) setWalletAddress(address);
        }
      } catch (err) {
        console.error("Freighter connection check failed:", err);
      }
    };
    checkConnection();
  }, []);


  const connectWallet = useCallback(async () => {
    try {
      setError(null);
      const connected = await isFreighterConnected();
      console.log("Attempting to connect... isConnected:", connected);
      
      if (!connected) {
        // If isConnected is false, but we can't be 100% sure it's not installed, 
        // we'll try to check if the global object exists at least.
        const hasApi = (typeof window !== "undefined") && (window.freighterApi || window.stellarPirate);
        if (!hasApi) {
          throw new Error("Freighter wallet not found. Please install the extension.");
        }
        console.log("API found but isConnected was false. Proceeding to getAddress to trigger popup.");
      }
      const { address, error: freighterError } = await getFreighterAddress();
      if (freighterError) throw new Error(freighterError);
      if (address) {
        setWalletAddress(address);
        return address;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
  }, []);

  const value = {
    contractId,
    setContractId,
    walletAddress,
    connectWallet,
    disconnectWallet,
    isInteractActive,
    setIsInteractActive,
    error,
    setError,
  };

  return <ContractContext.Provider value={value}>{children}</ContractContext.Provider>;
};

export const useContract = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContract must be used within a ContractProvider");
  }
  return context;
};
