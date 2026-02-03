export const parseBigintMaybeHex = (value: string) => {
  const v = value.trim().toLowerCase();
  if (v.startsWith("0x")) return BigInt(v);
  return BigInt(v);
};

export const formatDecimalFromBaseUnits = (value: bigint, decimals: number) => {
  if (decimals <= 0) return value.toString();
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const fraction = s.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};
