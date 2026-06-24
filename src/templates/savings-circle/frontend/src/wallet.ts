/**
 * Wallet detection for the workshop frontend.
 *
 * Resolution order:
 *   1. VITE_WALLET_ADDRESS — injected by the IDE preview bundler from the
 *      wallet already connected in the Deploy panel.
 *   2. Parent postMessage — live updates from the IDE while the preview runs
 *      inside a blob iframe (Freighter can't see blob: origins directly).
 *   3. Freighter extension — works when the app runs on a normal https/http
 *      origin (local Vite, Vercel deploy).
 *
 * In the IDE blob preview, `@stellar/freighter-api` is shimmed to postMessage
 * the parent window — Freighter popups open on the IDE origin for signing.
 */
import { useCallback, useEffect, useState } from "react";
import { getAddress, isConnected, requestAccess } from "@stellar/freighter-api";

const ENV_WALLET = (import.meta.env.VITE_WALLET_ADDRESS ?? "").toString().trim();

type WalletListener = (address: string | null) => void;
const listeners = new Set<WalletListener>();

let cachedAddress: string | null = ENV_WALLET || null;

const normalizeAddress = (value: unknown): string | null => {
  if (typeof value === "string" && value.startsWith("G") && value.length >= 56) {
    return value;
  }
  if (value && typeof value === "object" && "address" in value) {
    const addr = (value as { address?: unknown }).address;
    if (typeof addr === "string" && addr.startsWith("G")) return addr;
  }
  return null;
};

const setCachedAddress = (address: string | null) => {
  cachedAddress = address;
  listeners.forEach((fn) => fn(address));
};

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.type !== "soroban:wallet") return;
    const addr = normalizeAddress(data.address);
    if (addr) setCachedAddress(addr);
  });
}

/** Probe Freighter on the current origin (no popup). */
export async function detectFreighterAddress(): Promise<string | null> {
  if (cachedAddress) return cachedAddress;
  try {
    const connected = await isConnected();
    if (!connected?.isConnected) return null;
    const res = await getAddress();
    const addr = normalizeAddress(res);
    if (addr) {
      setCachedAddress(addr);
      return addr;
    }
  } catch {
    // Freighter unavailable — common inside the IDE blob preview.
  }
  return null;
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(cachedAddress);
  const [detecting, setDetecting] = useState(!cachedAddress);

  useEffect(() => {
    const onUpdate: WalletListener = (addr) => {
      setAddress(addr);
      if (addr) setDetecting(false);
    };
    listeners.add(onUpdate);
    return () => listeners.delete(onUpdate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cachedAddress) {
        setDetecting(false);
        return;
      }
      setDetecting(true);
      await detectFreighterAddress();
      // Blob iframes can't reach Freighter — give the IDE parent a moment
      // to postMessage the Deploy-panel wallet address.
      if (!cachedAddress) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!cancelled) {
        setAddress(cachedAddress);
        setDetecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    const res = await requestAccess();
    const addr = normalizeAddress(res);
    if (!addr) throw new Error("Freighter did not return an address");
    setCachedAddress(addr);
    return addr;
  }, []);

  return { address, detecting, connect };
}
