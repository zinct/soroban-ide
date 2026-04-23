import {
  isConnected,
  getAddress,
  requestAccess,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";
import { Transaction, TransactionBuilder, Networks, xdr as StellarXdr, StrKey } from "@stellar/stellar-base";

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/** Silent check — no popup. */
export const isFreighterConnected = async () => {
  try {
    const result = await isConnected();
    return result?.isConnected ?? false;
  } catch {
    return false;
  }
};

/** Silent address fetch — no popup. */
export const getFreighterAddress = async () => {
  try {
    const addr = await getAddress();
    return { address: addr?.address ?? addr };
  } catch (e) {
    return { error: e.message };
  }
};

/** Get current network info from Freighter. */
export const getFreighterNetwork = async () => {
  try {
    const result = await getNetwork();
    return result; // { network, networkPassphrase }
  } catch {
    return null;
  }
};

/** Explicit connect — triggers popup. Returns address + network warning if on mainnet. */
export const connectFreighter = async () => {
  try {
    const result = await requestAccess();
    if (result?.error) return { error: result.error };

    const addr = await getAddress();
    const address = addr?.address ?? addr;

    const net = await getFreighterNetwork();
    const isTestnet = net?.networkPassphrase === TESTNET_PASSPHRASE ||
                      net?.network?.toLowerCase().includes("test");

    return {
      address,
      network: net?.network,
      networkPassphrase: net?.networkPassphrase,
      wrongNetwork: !isTestnet,
    };
  } catch (e) {
    return { error: e.message };
  }
};

export const signFreighterTransaction = async (xdr) => {
  const result = await signTransaction(xdr, {
    networkPassphrase: TESTNET_PASSPHRASE,
  });
  // Freighter returns { signedTxXdr, error } or throws
  if (result?.error) {
    const msg = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
    throw new Error(msg);
  }
  return result?.signedTxXdr ?? result;
};

const SOROBAN_RPC = "https://soroban-testnet.stellar.org";

async function rpc(method, params) {
  const r = await fetch(SOROBAN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const d = await r.json();
  if (d?.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return d.result;
}

/**
 * Sign an already-assembled XDR (e.g. from `stellar contract deploy --build-only`)
 * with Freighter and submit it directly via Soroban RPC.
 *
 * The CLI builds the tx with the default (server-side) key as source.
 * We replace the source account with the Freighter address and re-fetch
 * the sequence number so Freighter can sign it as the true sender.
 */
export const signAndSubmitWithFreighter = async (assembledXdr, freighterAddress) => {
  // 1. Simulate (source is already the Freighter address from CLI --source freighter-wallet)
  const sim = await rpc("simulateTransaction", { transaction: assembledXdr });
  if (sim?.error) throw new Error(typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error));

  // 2. Fetch current account sequence — CLI may have used a stale sequence
  const accountResp = await fetch(`https://horizon-testnet.stellar.org/accounts/${freighterAddress}`);
  if (!accountResp.ok) throw new Error("Freighter account not found on testnet. Fund it first.");
  const { sequence } = await accountResp.json();

  // 3. Inject sorobanData + fee + correct sequence + timeBounds
  const env = StellarXdr.TransactionEnvelope.fromXDR(assembledXdr, "base64");
  const innerTx = env.v1().tx();
  const sorobanData = StellarXdr.SorobanTransactionData.fromXDR(sim.transactionData, "base64");
  innerTx.ext(new StellarXdr.TransactionExt(1, sorobanData));
  innerTx.fee(parseInt(sim.minResourceFee) + parseInt(innerTx.fee()));
  // Set sequence to account_sequence + 1
  const seqBuf = new Uint8Array(8);
  new DataView(seqBuf.buffer).setBigInt64(0, BigInt(sequence) + 1n);
  innerTx.seqNum(StellarXdr.SequenceNumber.fromXDR(seqBuf));
  const zeroBuf = new Uint8Array(8);
  innerTx.cond(StellarXdr.Preconditions.precondTime(
    new StellarXdr.TimeBounds({ minTime: StellarXdr.TimePoint.fromXDR(zeroBuf), maxTime: StellarXdr.TimePoint.fromXDR(zeroBuf) })
  ));
  // Inject auth entries from simulation into the invokeHostFunction operation
  const authEntries = (sim.results?.[0]?.auth || []).map(a =>
    StellarXdr.SorobanAuthorizationEntry.fromXDR(a, "base64")
  );
  if (authEntries.length > 0) {
    innerTx.operations()[0].body().invokeHostFunctionOp().auth(authEntries);
  }
  env.v1().signatures([]);

  // 4. Sign with Freighter
  const signedXdr = await signFreighterTransaction(env.toXDR("base64"));

  // 5. Submit and poll for contract ID
  const result = await rpc("sendTransaction", { transaction: signedXdr });
  if (result?.status === "ERROR") throw new Error(result.errorResultXdr || "Transaction failed");

  if (result?.hash) {
    // Compute contract ID deterministically from the deployer + salt in the XDR
    try {
      const env2 = StellarXdr.TransactionEnvelope.fromXDR(assembledXdr, "base64");
      const preimageFromAddr = env2.v1().tx().operations()[0]
        .body().invokeHostFunctionOp().hostFunction()
        .createContract().contractIdPreimage().fromAddress();
      const deployer = preimageFromAddr.address().accountId().ed25519();
      const salt = preimageFromAddr.salt();
      const networkId = await crypto.subtle.digest("SHA-256",
        new TextEncoder().encode("Test SDF Network ; September 2015"));
      const preimage = StellarXdr.HashIdPreimage.envelopeTypeContractId(
        new StellarXdr.HashIdPreimageContractId({
          networkId: new Uint8Array(networkId),
          contractIdPreimage: StellarXdr.ContractIdPreimage.contractIdPreimageFromAddress(
            new StellarXdr.ContractIdPreimageFromAddress({
              address: StellarXdr.ScAddress.scAddressTypeAccount(
                StellarXdr.AccountId.publicKeyTypeEd25519(deployer)
              ),
              salt,
            })
          ),
        })
      );
      const contractIdBytes = new Uint8Array(
        await crypto.subtle.digest("SHA-256", preimage.toXDR())
      );
      result.contractId = StrKey.encodeContract(contractIdBytes);
    } catch (_) {}

    // Poll for confirmation
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const tx = await rpc("getTransaction", { hash: result.hash });
      if (tx?.status === "SUCCESS") break;
      if (tx?.status === "FAILED") throw new Error(`Transaction failed on-chain: ${tx.resultXdr || JSON.stringify(tx)}`);
    }
  }
  return result;
};
