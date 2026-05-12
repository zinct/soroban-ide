import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { connectStellarWallet, getConnectedWallet, WALLET_PROVIDERS } from "../services/walletManager";
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
  const [walletNetworkPassphrase, setWalletNetworkPassphrase] = useState(null);
  const [walletProviderId, setWalletProviderId] = useState("freighter");
  const [walletClient, setWalletClient] = useState(null);
  const [isInteractActive, setIsInteractActive] = useState(false);
  const [error, setError] = useState(null);

  // Silent check on mount (currently Freighter path).
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await getConnectedWallet();
        if (!connected?.address) return;
        setWalletAddress(connected.address);
        setWalletNetwork(connected.network || null);
        setWalletNetworkPassphrase(connected.networkPassphrase || null);
        setWalletProviderId(connected.providerId || "freighter");
        setWalletClient(connected.client || null);
        if ((connected.providerId || "freighter") === "freighter") {
          safeRegisterFreighter(connected.address);
        }
      } catch (err) {
        // Silently ignore — user hasn't connected yet
      }
    };
    checkConnection();
  }, []);


  const connectWallet = useCallback(async (providerId = walletProviderId) => {
    try {
      setError(null);
      const { address, network, networkPassphrase, wrongNetwork, client, providerId: connectedProvider } = await connectStellarWallet(providerId);
      if (address) {
        setWalletAddress(address);
        setWalletNetwork(network || null);
        setWalletNetworkPassphrase(networkPassphrase || null);
        setWalletProviderId(connectedProvider || providerId);
        setWalletClient(client || null);
        // Register public key in runner container so CLI can use it as --source.
        // Backend endpoint is currently Freighter-specific.
        if ((connectedProvider || providerId) === "freighter") {
          safeRegisterFreighter(address);
        }
        if (wrongNetwork) {
          setError("⚠️ Wallet is not on Testnet. Please switch to Testnet in your wallet settings.");
        }
        return address;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [walletProviderId]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setWalletNetwork(null);
    setWalletNetworkPassphrase(null);
    setWalletClient(null);
  }, []);

  const value = {
    contractId, setContractId,
    walletAddress, walletNetwork,
    walletNetworkPassphrase,
    walletProviderId, setWalletProviderId,
    walletClient,
    walletProviders: WALLET_PROVIDERS,
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
