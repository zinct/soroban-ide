/**
 * Runtime contract ID for in-IDE preview.
 * In the IDE blob preview, ignore build-time VITE_CONTRACT_ID entirely —
 * it is often stale. The parent injects __SOROBAN_PREVIEW_CONTRACT__ and
 * postMessages live updates (same pattern as wallet.ts).
 */
import { useEffect, useState } from "react";

const BUILD_ID = (import.meta.env.VITE_CONTRACT_ID ?? "").toString().trim();

const isIdePreview = () =>
  typeof window !== "undefined"
  && (window as unknown as { __SOROBAN_IDE_PREVIEW__?: boolean }).__SOROBAN_IDE_PREVIEW__ === true;

const readInjectedContractId = (): string => {
  if (typeof window === "undefined") return "";
  const injected = (window as unknown as { __SOROBAN_PREVIEW_CONTRACT__?: unknown })
    .__SOROBAN_PREVIEW_CONTRACT__;
  return (injected ?? "").toString().trim();
};

type ContractListener = (contractId: string) => void;
const listeners = new Set<ContractListener>();

let runtimeId = isIdePreview() ? readInjectedContractId() : BUILD_ID;

export const getContractId = (): string => runtimeId;

export const onContractIdChange = (fn: ContractListener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const setRuntimeContractId = (contractId: string) => {
  const next = (contractId ?? "").toString().trim();
  if (next === runtimeId) return;
  runtimeId = next;
  listeners.forEach((fn) => fn(runtimeId));
};

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.source !== "soroban-ide" || data?.type !== "soroban:contract") return;
    setRuntimeContractId(data.contractId ?? "");
  });
}

/** Reactive contract id — prefer this in React components over the build-time export. */
export function useContractId(): string {
  const [id, setId] = useState(() => getContractId());
  useEffect(() => onContractIdChange(setId), []);
  return id;
}
