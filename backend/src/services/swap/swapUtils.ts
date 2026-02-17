export const toBaseUnits = (amount: string, decimals: number) => {
  const [whole, fractionRaw = ""] = amount.split(".");
  const fraction = fractionRaw.padEnd(decimals, "0").slice(0, decimals);
  const normalizedWhole = (whole ?? "0").replace(/^0+(?=\d)/, "") || "0";
  const normalized = `${normalizedWhole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(normalized);
};

export const isCircleTxDone = (state: string) => {
  const s = state.toUpperCase();
  return s === "COMPLETE" || s === "COMPLETED" || s === "CONFIRMED";
};

export const isCircleTxFailed = (state: string) => {
  const s = state.toUpperCase();
  return s === "FAILED" || s === "CANCELLED" || s === "DENIED" || s === "REJECTED";
};
