import { useEffect, useState } from "react";

/**
 * Formats a numeric value or raw string into Indonesian thousand-delimited format
 * (dot '.' for thousands, comma ',' for decimals).
 */
export function formatIdrNumber(
  value: number | string,
  allowNegative = false
): string {
  if (value === "" || value === null || value === undefined) return "";
  const str = typeof value === "number" ? String(value) : value;
  const trimmed = str.trim();
  if (!trimmed) return "";

  const isNegative = allowNegative && trimmed.startsWith("-");
  // Normalize: if it's a JS number string (e.g. "1234.56"), convert '.' decimal to ','
  let normalized = trimmed.replace(/^-/, "");
  if (typeof value === "number") {
    normalized = normalized.replace(".", ",");
  }

  const parts = normalized.split(",");
  const intDigits = parts[0].replace(/\D/g, "");
  const decDigits =
    parts.length > 1 ? parts.slice(1).join("").replace(/\D/g, "").slice(0, 2) : null;

  if (!intDigits && decDigits === null) {
    return isNegative ? "-" : "";
  }

  const formattedInt = intDigits
    ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : "0";

  const prefix = isNegative ? "-" : "";
  return decDigits !== null ? `${prefix}${formattedInt},${decDigits}` : `${prefix}${formattedInt}`;
}

/**
 * Parses an Indonesian-formatted currency string (e.g. "1.000.000,50" or "-50.000")
 * back into a finite JS number (or NaN if empty/invalid).
 */
export function parseIdrNumber(formatted: string): number {
  const cleaned = formatted.trim();
  if (!cleaned || cleaned === "-") return NaN;
  const isNegative = cleaned.startsWith("-");
  const body = cleaned.replace(/^-/, "").replace(/\./g, "").replace(",", ".");
  const num = Number(body);
  if (!Number.isFinite(num)) return NaN;
  return isNegative ? -num : num;
}

interface CurrencyInputProps {
  value: string;
  onChangeValue: (numericString: string) => void;
  allowNegative?: boolean;
  placeholder?: string;
  required?: boolean;
  min?: number;
}

export function CurrencyInput({
  value,
  onChangeValue,
  allowNegative = false,
  placeholder = "0",
  required = false,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState<string>(() => {
    if (!value) return "";
    const num = Number(value);
    return Number.isFinite(num) ? formatIdrNumber(num, allowNegative) : "";
  });

  useEffect(() => {
    if (value === "" || value === "-") {
      setDisplay(value);
      return;
    }
    const parsedCurrent = parseIdrNumber(display);
    const parsedProp = Number(value);
    if (
      Number.isFinite(parsedProp) &&
      parsedCurrent !== parsedProp
    ) {
      setDisplay(formatIdrNumber(parsedProp, allowNegative));
    }
  }, [value, allowNegative]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      setDisplay("");
      onChangeValue("");
      return;
    }
    if (allowNegative && raw === "-") {
      setDisplay("-");
      onChangeValue("");
      return;
    }

    // Strip dots (existing thousand separators), keep digits, single comma, and optional leading '-'
    const isNeg = allowNegative && raw.startsWith("-");
    const stripped = raw.replace(/^-/, "").replace(/\./g, "");
    const commaIdx = stripped.indexOf(",");
    let clean = "";
    if (commaIdx >= 0) {
      const intPart = stripped.slice(0, commaIdx).replace(/\D/g, "");
      const decPart = stripped.slice(commaIdx + 1).replace(/\D/g, "").slice(0, 2);
      clean = `${intPart || "0"},${decPart}`;
    } else {
      clean = stripped.replace(/\D/g, "");
    }

    const formatted = formatIdrNumber(`${isNeg ? "-" : ""}${clean}`, allowNegative);
    setDisplay(formatted);

    const parsed = parseIdrNumber(formatted);
    onChangeValue(Number.isFinite(parsed) ? String(parsed) : "");
  }

  return (
    <div className="currency-input-wrap">
      <span className="currency-prefix">Rp</span>
      <input
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
