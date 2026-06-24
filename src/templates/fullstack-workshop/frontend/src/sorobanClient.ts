/**
 * Soroban RPC client with u32-safe args, preview action logging, and Freighter signing.
 */
import {
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
  scValToNative,
  nativeToScVal,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const NETWORK = (import.meta.env.VITE_NETWORK ?? "TESTNET").toString().toUpperCase();
const CONTRACT_ID = (import.meta.env.VITE_CONTRACT_ID ?? "").toString();
const DEPLOY_HINT = "Deploy contracts/counter in the Deploy panel, set VITE_CONTRACT_ID, then Rebuild preview.";

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

const formatMethod = (method: string, args: unknown[]) =>
  args.length ? `${method}(${args.join(", ")})` : method;

/**
 * Soroban u32 params must be ScVal U32.
 * nativeToScVal(100) defaults to U64 in SDK v15 — passing that to a u32 param traps the VM.
 */
const argsToScVals = (args: unknown[]): xdr.ScVal[] =>
  args.map((arg) => {
    if (typeof arg === "number" && Number.isInteger(arg) && arg >= 0 && arg <= 0xffffffff) {
      return nativeToScVal(arg >>> 0, { type: "u32" });
    }
    if (typeof arg === "bigint" && arg >= 0n && arg <= 0xffffffffn) {
      return nativeToScVal(Number(arg), { type: "u32" });
    }
    return nativeToScVal(arg);
  });

const scValTypeName = (val: xdr.ScVal) => val.switch().name;

const formatRpcError = (err: unknown, context: string): Error => {
  const message = err instanceof Error ? err.message : String(err);
  if (/bad union switch/i.test(message)) {
    return new Error(
      `${context}: Stellar SDK is too old (Bad union switch). `
      + "Use @stellar/stellar-sdk ^15.1.0+, then Rebuild preview.",
    );
  }
  if (/unreachable|invalidaction|vm call trapped/i.test(message)) {
    return new Error(
      `${context}: Contract rejected the call (${message}). `
      + "If this is a write with a numeric amount, rebuild preview (U32 encoding fix) "
      + "and redeploy the contract WASM. "
      + DEPLOY_HINT,
    );
  }
  return err instanceof Error ? err : new Error(message);
};

const requireContract = () => {
  if (!CONTRACT_ID) {
    throw new Error(`VITE_CONTRACT_ID is not set — ${DEPLOY_HINT}`);
  }
  if (CONTRACT_ID.startsWith("G")) {
    throw new Error("VITE_CONTRACT_ID looks like a wallet (G…). Use the contract ID from Deploy (C…).");
  }
  return new Contract(CONTRACT_ID);
};

export const simulate = async <T = unknown>(
  method: string,
  source: string,
  args: unknown[] = [],
): Promise<T> => {
  const label = formatMethod(method, args);
  const scVals = argsToScVals(args);
  console.log(`[contract] simulate ${label}`, args.length ? `(arg types: ${scVals.map(scValTypeName).join(", ")})` : "");
  try {
    const contract = requireContract();
    const account = await server.getAccount(source);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...scVals))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      const err = sim.error || "Simulation failed";
      if (/non-existent contract function/i.test(err)) {
        throw new Error(`No "${method}" on this contract. ${DEPLOY_HINT}`);
      }
      throw new Error(`Simulation failed: ${err}`);
    }
    const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!retval) throw new Error("Simulation returned no value");
    const value = scValToNative(retval) as T;
    console.log(`[contract] simulate ${label} ✓`, value);
    return value;
  } catch (err) {
    console.error(`[contract] simulate ${label} ✗`, err);
    throw formatRpcError(err, `Read ${label} failed`);
  }
};

export const invokeWrite = async <T = unknown>(
  method: string,
  source: string,
  signXDR: (xdr: string, opts: { networkPassphrase: string; address: string }) => Promise<string | { signedTxXdr?: string }>,
  args: unknown[] = [],
): Promise<T> => {
  const label = formatMethod(method, args);
  const scVals = argsToScVals(args);
  console.log(`[contract] invoke ${label}`, `(arg types: ${scVals.map(scValTypeName).join(", ") || "none"})`);
  try {
    const contract = requireContract();
    const account = await server.getAccount(source);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...scVals))
      .setTimeout(60)
      .build();

    // Simulate before Freighter — surfaces arg/type errors without a wallet popup.
    const preSim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(preSim)) {
      throw new Error(preSim.error || "Pre-sign simulation failed");
    }

    const prepared = await server.prepareTransaction(tx);
    console.log(`[contract] invoke ${label} → Freighter sign popup`);
    const signed = await signXDR(prepared.toXDR(), {
      networkPassphrase: config.networkPassphrase,
      address: source,
    });
    const signedXdr = typeof signed === "string" ? signed : signed.signedTxXdr ?? "";
    if (!signedXdr) throw new Error("Wallet returned an empty signed XDR");

    console.log(`[contract] invoke ${label} → submitting`);
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
    const result = (retval ? scValToNative(retval) : undefined) as T;
    console.log(`[contract] invoke ${label} ✓ confirmed`, result ?? "(no return value)");
    return result;
  } catch (err) {
    console.error(`[contract] invoke ${label} ✗`, err);
    throw formatRpcError(err, `Write ${label} failed`);
  }
};
