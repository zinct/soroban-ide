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

export const signFreighterTransaction = async (xdr, address) => {
  // Pass `address` so Freighter signs with the exact account the IDE has
  // recorded — avoids signing with a different account when the user has
  // multiple in the extension.
  const result = await signTransaction(xdr, {
    networkPassphrase: TESTNET_PASSPHRASE,
    ...(address ? { address } : {}),
  });
  // Freighter returns { signedTxXdr, error } or throws
  if (result?.error) {
    const msg = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
    throw new Error(msg);
  }
  return result?.signedTxXdr ?? result;
};

// Stellar TransactionResultCode → human-readable. Keeps deploy errors
// debuggable instead of leaving the user with a base64 blob.
const TX_RESULT_CODES = {
  0: "txSuccess",
  [-1]: "txFailed",
  [-2]: "txTooEarly",
  [-3]: "txTooLate",
  [-4]: "txMissingOperation",
  [-5]: "txBadSeq (sequence number mismatch — account state changed mid-deploy)",
  [-6]: "txBadAuth (signature didn't match transaction source)",
  [-7]: "txInsufficientBalance",
  [-8]: "txNoAccount (source account not found on the network)",
  [-9]: "txInsufficientFee",
  [-10]: "txBadAuthExtra",
  [-11]: "txInternalError",
  [-12]: "txNotSupported",
  [-13]: "txFeeBumpInnerFailed",
  [-14]: "txBadSponsorship",
  [-15]: "txBadMinSeqAgeOrGap",
  [-16]: "txMalformed",
  [-17]: "txSorobanInvalid",
};

/**
 * Best-effort decode of a Stellar TransactionResult XDR (base64) into a
 * useful one-liner. Returns the original base64 if decode fails so the
 * user always gets *something* to grep for.
 */
export const decodeErrorResultXdr = (b64) => {
  if (!b64) return "unknown error";
  try {
    const result = StellarXdr.TransactionResult.fromXDR(b64, "base64");
    const code = result.result().switch().value;
    const label = TX_RESULT_CODES[code];
    return label ? `${label} (code ${code})` : `txResultCode ${code}`;
  } catch {
    return b64;
  }
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

async function getAccountSequence(address) {
  // Prefer Soroban RPC's account view to avoid Horizon lag causing stale
  // sequence reads during quick sign+submit loops.
  try {
    const acc = await rpc("getAccount", { address });
    const seq = acc?.seqNum ?? acc?.sequence;
    if (seq != null) return BigInt(seq);
  } catch {
    // Fallback to Horizon below.
  }

  const accountResp = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
  if (!accountResp.ok) {
    throw new Error("Freighter account not found on testnet. Fund it first via Friendbot.");
  }
  const { sequence } = await accountResp.json();
  return BigInt(sequence);
}

/**
 * Sign an already-assembled XDR (e.g. from `stellar contract deploy --build-only`)
 * with Freighter and submit it directly via Soroban RPC.
 *
 * The CLI's --build-only outputs an unsigned tx with `--source freighter-wallet`
 * already as source, but without sorobanData/auth (which require simulation)
 * and with whatever sequence number the CLI saw at build time. We:
 *
 *   1. simulate to get sorobanData / minResourceFee / auth entries
 *   2. fetch the current sequence from Horizon and set seq = current + 1
 *   3. inject all of the above into the envelope
 *   4. sign with Freighter (passing the explicit address)
 *   5. submit via Soroban RPC and poll for confirmation
 *
 * Auto-retries once on txBadSeq because Freighter's signing popup can take
 * long enough that another tx from the same account lands in between fetch
 * and submit.
 */
export const signAndSubmitWithFreighter = async (assembledXdr, freighterAddress) => {
  return await _signAndSubmitOnce(assembledXdr, freighterAddress, /* allowRetry */ true);
};

const _signAndSubmitOnce = async (assembledXdr, freighterAddress, allowRetry) => {
  const sim = await rpc("simulateTransaction", { transaction: assembledXdr });
  if (sim?.error) {
    throw new Error(`Simulation failed: ${typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error)}`);
  }

  const sequence = await getAccountSequence(freighterAddress);

  const env = StellarXdr.TransactionEnvelope.fromXDR(assembledXdr, "base64");
  const innerTx = env.v1().tx();
  const sorobanData = StellarXdr.SorobanTransactionData.fromXDR(sim.transactionData, "base64");
  innerTx.ext(new StellarXdr.TransactionExt(1, sorobanData));
  innerTx.fee(parseInt(sim.minResourceFee) + parseInt(innerTx.fee()));
  const seqBuf = new Uint8Array(8);
  new DataView(seqBuf.buffer).setBigInt64(0, sequence + 1n);
  innerTx.seqNum(StellarXdr.SequenceNumber.fromXDR(seqBuf));
  const zeroBuf = new Uint8Array(8);
  innerTx.cond(StellarXdr.Preconditions.precondTime(
    new StellarXdr.TimeBounds({ minTime: StellarXdr.TimePoint.fromXDR(zeroBuf), maxTime: StellarXdr.TimePoint.fromXDR(zeroBuf) })
  ));
  const authEntries = (sim.results?.[0]?.auth || []).map(a =>
    StellarXdr.SorobanAuthorizationEntry.fromXDR(a, "base64")
  );
  if (authEntries.length > 0) {
    innerTx.operations()[0].body().invokeHostFunctionOp().auth(authEntries);
  }
  env.v1().signatures([]);

  let signedXdr;
  try {
    signedXdr = await signFreighterTransaction(env.toXDR("base64"), freighterAddress);
  } catch (e) {
    // User rejected, locked extension, etc. — preserve the raw message but
    // tag it so the caller can label it accurately.
    const err = new Error(`Freighter sign rejected: ${e.message}`);
    err.stage = "sign";
    throw err;
  }

  const result = await rpc("sendTransaction", { transaction: signedXdr });
  if (result?.status === "ERROR") {
    const decoded = decodeErrorResultXdr(result.errorResultXdr);
    // txBadSeq is the one we can recover from automatically — Freighter's
    // sign popup is slow enough that another tx from this account can land
    // between fetch and submit.
    if (allowRetry && /txBadSeq/.test(decoded)) {
      // Small pause gives RPC/Horizon state a chance to settle if another tx
      // landed from the same account right before submit.
      await new Promise((r) => setTimeout(r, 650));
      return await _signAndSubmitOnce(assembledXdr, freighterAddress, false);
    }
    const err = new Error(`Transaction rejected: ${decoded}`);
    err.stage = "submit";
    throw err;
  }

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
      if (tx?.status === "FAILED") {
        const err = new Error(`Transaction failed on-chain: ${decodeErrorResultXdr(tx.resultXdr)}`);
        err.stage = "onchain";
        throw err;
      }
    }
  }
  return result;
};
