import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { isFreighterConnected, getFreighterAddress, getFreighterNetwork, connectFreighter } from "../services/freighter";
import { registerFreighterWallet } from "../services/backendService";

const ContractContext = createContext(null);

// Module-level cache of addresses we've already registered with the backend.
// Module scope (not React state/ref) is intentional: it survives React 18
// StrictMode's double-invocation of effects in dev, which is the actual
// source of the duplicate POST /wallet/freighter/register that produces a
// noisy "already exists" error in the runner logs.
const registeredAddresses = new Set();
const safeRegisterFreighter = (address) => {
  if (!address || registeredAddresses.has(address)) return;
  registeredAddresses.add(address);
  registerFreighterWallet(address).catch(() => {
    // On failure, allow a future retry by removing the address from the cache.
    registeredAddresses.delete(address);
  });
};

export const ContractProvider = ({ children }) => {
  const [contractId, setContractId] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletNetwork, setWalletNetwork] = useState(null);
  const [isInteractActive, setIsInteractActive] = useState(false);
  const [error, setError] = useState(null);

  // Check if Freighter is already connected on mount — NO popup, silent only
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await isFreighterConnected();
        if (connected) {
          const [{ address }, net] = await Promise.all([getFreighterAddress(), getFreighterNetwork()]);
          if (address) {
            setWalletAddress(address);
            setWalletNetwork(net?.network || null);
            safeRegisterFreighter(address);
          }
        }
      } catch (err) {
        // Silently ignore — user hasn't connected yet
      }
    };
    checkConnection();
  }, []);


  const connectWallet = useCallback(async () => {
    try {
      setError(null);
      const { address, network, wrongNetwork, error: freighterError } = await connectFreighter();
      if (freighterError) {
        // Freighter occasionally returns `{ code, message }` here, not a string.
        // Without coercion this becomes "[object Object]" in the wallet card.
        const msg =
          typeof freighterError === "string" ? freighterError :
          (freighterError?.message || JSON.stringify(freighterError));
        throw new Error(msg);
      }
      if (address) {
        setWalletAddress(address);
        setWalletNetwork(network || null);
        // Register public key in runner container so CLI can use it as --source
        safeRegisterFreighter(address);
        if (wrongNetwork) {
          setError("⚠️ Freighter is on Mainnet. Please switch to Testnet in Freighter settings.");
        }
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
    contractId, setContractId,
    walletAddress, walletNetwork,
    connectWallet, disconnectWallet,
    isInteractActive, setIsInteractActive,
    error, setError,
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
