/**
 * Thin wrapper around the Stellar SDK for talking to a Soroban contract.
 *
 * Read-only methods (e.g. `get`) use the RPC's `simulateTransaction` endpoint
 * and never touch the wallet. Write methods build a real transaction, ask
 * Freighter to sign it, then submit it through `sendTransaction` and poll
 * until the network confirms.
 */
import {
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
  scValToNative,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const NETWORK = (import.meta.env.VITE_NETWORK ?? "TESTNET").toString().toUpperCase();
const CONTRACT_ID = (import.meta.env.VITE_CONTRACT_ID ?? "").toString();

const NETWORK_CONFIG = {
  TESTNET: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
  },
  MAINNET: {
    rpcUrl: "https://soroban.stellar.org",
    networkPassphrase: Networks.PUBLIC,
  },
} as const;

type NetworkKey = keyof typeof NETWORK_CONFIG;

const config = NETWORK_CONFIG[(NETWORK in NETWORK_CONFIG ? NETWORK : "TESTNET") as NetworkKey];

export const networkPassphrase = config.networkPassphrase;
export const networkLabel = (NETWORK in NETWORK_CONFIG ? NETWORK : "TESTNET");
export const contractId = CONTRACT_ID;

export const server = new rpc.Server(config.rpcUrl, { allowHttp: false });

const formatRpcError = (err: unknown, context: string): Error => {
  const message = err instanceof Error ? err.message : String(err);
  if (/bad union switch/i.test(message)) {
    return new Error(
      `${context}: Stellar SDK is too old to read testnet responses (Bad union switch). `
      + "Update @stellar/stellar-sdk to ^15.1.0 or newer in frontend/package.json, then Rebuild preview.",
    );
  }
  return err instanceof Error ? err : new Error(message);
};

const requireContract = () => {
  if (!CONTRACT_ID) {
    throw new Error(
      "VITE_CONTRACT_ID is not set — deploy the counter contract first and put its ID in your .env",
    );
  }
  if (CONTRACT_ID.startsWith("G")) {
    throw new Error(
      "VITE_CONTRACT_ID looks like a wallet address (G…). Use the contract ID from the Deploy panel (starts with C…).",
    );
  }
  return new Contract(CONTRACT_ID);
};

/**
 * Run a Soroban method as a read-only simulation. Used for "view" functions
 * that don't need to sign or submit anything.
 */
export const simulate = async <T = unknown>(method: string, source: string): Promise<T> => {
  try {
    const contract = requireContract();
    const account = await server.getAccount(source);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call(method))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      const err = sim.error || "Simulation failed";
      if (/non-existent contract function/i.test(err)) {
        throw new Error(
          `This contract does not have a "${method}" function. `
          + "Deploy your contract in the Deploy panel, set VITE_CONTRACT_ID in .env, then Rebuild preview.",
        );
      }
      throw new Error(`Simulation failed: ${err}`);
    }
    const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!retval) throw new Error("Simulation returned no value");
    return scValToNative(retval) as T;
  } catch (err) {
    throw formatRpcError(err, "Read call failed");
  }
};

/**
 * Build a write transaction, hand it to the signer, submit, and poll until
 * it lands on-chain (or fails). Returns the decoded return value.
 *
 * @param method   contract method name (e.g. "increment")
 * @param source   public key of the source account (will pay the fee + sign)
 * @param signXDR  callback that takes the unsigned XDR and resolves to a
 *                 signed XDR — typically Freighter's `signTransaction`.
 */
export const invokeWrite = async <T = unknown>(
  method: string,
  source: string,
  signXDR: (xdr: string, opts: { networkPassphrase: string; address: string }) => Promise<string | { signedTxXdr?: string }>,
): Promise<T> => {
  try {
    const contract = requireContract();
    const account = await server.getAccount(source);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call(method))
      .setTimeout(60)
      .build();

    const prepared = await server.prepareTransaction(tx);

    const signed = await signXDR(prepared.toXDR(), {
      networkPassphrase: config.networkPassphrase,
      address: source,
    });
    const signedXdr = typeof signed === "string" ? signed : signed.signedTxXdr ?? "";
    if (!signedXdr) throw new Error("Wallet returned an empty signed XDR");

    const finalTx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
    const sent = await server.sendTransaction(finalTx);
    if (sent.status === "ERROR") {
      throw new Error(`Transaction rejected: ${sent.errorResult?.toXDR("base64") ?? "unknown"}`);
    }

    const deadline = Date.now() + 30_000;
    let getResp: rpc.Api.GetTransactionResponse | null = null;
    while (Date.now() < deadline) {
      getResp = await server.getTransaction(sent.hash);
      if (getResp.status !== "NOT_FOUND" && getResp.status !== "PENDING") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!getResp || getResp.status !== "SUCCESS") {
      throw new Error(`Transaction did not succeed: ${getResp?.status ?? "timeout"}`);
    }

    const retval: xdr.ScVal | undefined = getResp.returnValue;
    return (retval ? scValToNative(retval) : undefined) as T;
  } catch (err) {
    throw formatRpcError(err, "Write call failed");
  }
};
