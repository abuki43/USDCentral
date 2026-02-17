type FormatOptions = {
  maxFraction?: number;
  minFraction?: number;
  group?: boolean;
};

const DEFAULT_MAX_FRACTION = 2;
const DEFAULT_MIN_FRACTION = 0;

const groupThousands = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const incrementWhole = (whole: string) => {
  const digits = whole.split("");
  let i = digits.length - 1;
  while (i >= 0) {
    if (digits[i] !== "9") {
      digits[i] = String(Number(digits[i]) + 1);
      return digits.join("");
    }
    digits[i] = "0";
    i -= 1;
  }
  return `1${digits.join("")}`;
};

const roundFraction = (
  whole: string,
  fraction: string,
  maxFraction: number,
) => {
  if (fraction.length <= maxFraction) return { whole, fraction };
  const nextDigit = fraction[maxFraction] ?? "0";
  let rounded = fraction.slice(0, maxFraction);
  if (nextDigit < "5") return { whole, fraction: rounded };

  if (maxFraction === 0) {
    return { whole: incrementWhole(whole), fraction: "" };
  }

  const digits = rounded.split("");
  let i = digits.length - 1;
  while (i >= 0) {
    if (digits[i] !== "9") {
      digits[i] = String(Number(digits[i]) + 1);
      return { whole, fraction: digits.join("") };
    }
    digits[i] = "0";
    i -= 1;
  }

  return { whole: incrementWhole(whole), fraction: "0".repeat(maxFraction) };
};

export const formatDecimal = (value: string, options: FormatOptions = {}) => {
  const maxFraction = options.maxFraction ?? DEFAULT_MAX_FRACTION;
  const minFraction = options.minFraction ?? DEFAULT_MIN_FRACTION;
  const group = options.group !== false;

  const raw = value.trim();
  if (!raw) return "0";

  const negative = raw.startsWith("-");
  const cleaned = negative ? raw.slice(1) : raw;
  const [wholeRaw, fractionRaw = ""] = cleaned.split(".");
  const wholeNormalized = wholeRaw.replace(/^0+(?=\d)/, "") || "0";

  const rounded = roundFraction(wholeNormalized, fractionRaw, maxFraction);
  let fraction = rounded.fraction;

  if (fraction.length < minFraction) {
    fraction = fraction.padEnd(minFraction, "0");
  } else if (fraction.length > minFraction) {
    fraction = fraction.replace(/0+$/, "");
    if (fraction.length < minFraction) {
      fraction = fraction.padEnd(minFraction, "0");
    }
  }

  const whole = group ? groupThousands(rounded.whole) : rounded.whole;
  const sign = negative && (whole !== "0" || fraction !== "") ? "-" : "";
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
};

export const formatFromBaseUnits = (
  value: string,
  decimals: number,
  options: FormatOptions = {},
) => {
  const normalized = value.replace(/^0+(?=\d)/, "") || "0";
  if (decimals <= 0) return formatDecimal(normalized, options);

  const padded =
    normalized.length <= decimals
      ? normalized.padStart(decimals + 1, "0")
      : normalized;
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = padded.slice(-decimals);
  return formatDecimal(`${whole}.${fraction}`, options);
};

export const formatUsdcAmount = (value: string) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0 && numeric < 0.01) {
    return "<0.01";
  }
  return formatDecimal(value, { maxFraction: 2, minFraction: 2 });
};
