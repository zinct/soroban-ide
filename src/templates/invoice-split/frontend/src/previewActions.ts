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
