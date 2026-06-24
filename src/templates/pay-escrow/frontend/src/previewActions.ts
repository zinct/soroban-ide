/** Preview terminal activity logs (captured by the IDE preview console bridge). */

export const logAction = (message: string, level: "info" | "warn" | "error" = "info") => {
  const line = `[action] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export const ensureConnected = async (
  address: string | null,
  connect: () => Promise<string>,
): Promise<string> => {
  if (address) return address;
  logAction("connect → opening Freighter wallet");
  const addr = await connect();
  logAction(`connected ${addr.slice(0, 4)}…${addr.slice(-4)}`);
  return addr;
};

export const isWrongContractError = (message: string, method?: string) =>
  /non-existent contract function|MissingValue|No "[^"]+" on this contract/i.test(message)
  || Boolean(method && /No "/i.test(message) && message.includes(method));

export type SetupStatus = { kind: "setup"; title: string; message: string };
export type ErrorStatus = { kind: "error"; message: string };

export const applyContractError = (
  message: string,
  deployHint: string,
  method?: string,
): SetupStatus | ErrorStatus =>
  isWrongContractError(message, method)
    ? { kind: "setup", title: "Wrong contract linked", message: `${message} ${deployHint}` }
    : { kind: "error", message };
