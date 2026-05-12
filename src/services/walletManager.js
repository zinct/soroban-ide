import {
  TESTNET_PASSPHRASE,
  isFreighterConnected,
  getFreighterAddress,
  getFreighterNetwork,
  connectFreighter,
  signFreighterTransaction,
} from "./freighter";

/**
 * Unified wallet script for Stellar wallet providers.
 * Freighter remains fully supported, and other providers can be enabled via
 * Stellar Wallets SDK without rewriting caller code.
 */

export const WALLET_PROVIDERS = [
  { id: "freighter", label: "Freighter", type: "extension" },
  { id: "xbull", label: "xBull", type: "extension" },
  { id: "albedo", label: "Albedo", type: "web" },
  { id: "lobstr", label: "LOBSTR", type: "web" },
];

const SDK_PACKAGE = "@creit.tech/stellar-wallets-kit";

const normalizeNetwork = (network, passphrase) => {
  if (passphrase === TESTNET_PASSPHRASE) return "testnet";
  const n = String(network || "").toLowerCase();
  if (n.includes("test")) return "testnet";
  if (n.includes("public") || n.includes("main")) return "mainnet";
  return n || "unknown";
};

async function loadWalletSdk() {
  try {
    const mod = await import(/* @vite-ignore */ SDK_PACKAGE);
    return mod?.WalletsKit ? mod : mod?.default || mod;
  } catch (err) {
    throw new Error(
      `Wallet SDK not available (${SDK_PACKAGE}). Install it to enable non-Freighter wallets.`,
    );
  }
}

/**
 * Connect wallet by provider id.
 * Returns a normalized payload that callers can store safely in state.
 */
export async function connectStellarWallet(providerId = "freighter") {
  if (providerId === "freighter") {
    const r = await connectFreighter();
    if (r?.error) throw new Error(r.error);
    return {
      providerId: "freighter",
      address: r?.address || null,
      network: normalizeNetwork(r?.network, r?.networkPassphrase),
      networkPassphrase: r?.networkPassphrase || null,
      wrongNetwork: !!r?.wrongNetwork,
    };
  }

  const sdk = await loadWalletSdk();
  const WalletsKit = sdk?.WalletsKit || sdk?.default?.WalletsKit || sdk?.default;
  if (typeof WalletsKit !== "function") {
    throw new Error("Wallet SDK loaded, but WalletsKit constructor was not found.");
  }

  // Wallets Kit API can vary across versions; this script keeps the integration
  // in one place so we can adapt quickly without touching UI/business code.
  const kit = new WalletsKit({
    network: "TESTNET",
    selectedWalletId: providerId,
  });

  let selected = providerId;
  if (typeof kit.setWallet === "function") {
    await kit.setWallet(providerId);
  } else if (typeof kit.selectWallet === "function") {
    await kit.selectWallet(providerId);
  } else if (kit.wallet?.id) {
    selected = kit.wallet.id;
  }

  let addressResult = null;
  if (typeof kit.getAddress === "function") {
    addressResult = await kit.getAddress();
  } else if (typeof kit.connect === "function") {
    addressResult = await kit.connect();
  }
  const address = addressResult?.address || addressResult?.publicKey || addressResult || null;
  if (!address) {
    throw new Error("Wallet connected, but no public address was returned.");
  }

  const passphrase =
    addressResult?.networkPassphrase ||
    addressResult?.passphrase ||
    TESTNET_PASSPHRASE;
  return {
    providerId: selected,
    address,
    network: normalizeNetwork(addressResult?.network, passphrase),
    networkPassphrase: passphrase,
    wrongNetwork: passphrase !== TESTNET_PASSPHRASE,
    // Keep instance so callers can sign through this provider later.
    client: kit,
  };
}

/**
 * Silent check for pre-connected wallets.
 * Currently implemented for Freighter; other providers usually require explicit user action.
 */
export async function getConnectedWallet() {
  const connected = await isFreighterConnected();
  if (!connected) return null;
  const [addr, net] = await Promise.all([getFreighterAddress(), getFreighterNetwork()]);
  if (!addr?.address) return null;
  return {
    providerId: "freighter",
    address: addr.address,
    network: normalizeNetwork(net?.network, net?.networkPassphrase),
    networkPassphrase: net?.networkPassphrase || null,
    wrongNetwork: net?.networkPassphrase && net.networkPassphrase !== TESTNET_PASSPHRASE,
  };
}

/**
 * Sign XDR using the connected provider.
 * Freighter uses the existing stable path; other providers use Wallet SDK if available.
 */
export async function signWithWallet(assembledXdr, walletState) {
  const providerId = walletState?.providerId || "freighter";
  if (providerId === "freighter") {
    return signFreighterTransaction(assembledXdr, walletState?.address);
  }

  const kit = walletState?.client;
  if (!kit) {
    throw new Error("No wallet client found for selected provider.");
  }
  if (typeof kit.signTransaction !== "function") {
    throw new Error("Selected wallet provider does not support signTransaction.");
  }

  const signed = await kit.signTransaction(assembledXdr, {
    networkPassphrase: walletState?.networkPassphrase || TESTNET_PASSPHRASE,
  });
  return signed?.signedTxXdr || signed?.xdr || signed;
}
