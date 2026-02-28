/**
 * Volume tier bracket utilities.
 * Brackets are auto-derived: max = next tier's min - 1, or null for uncapped last tier.
 */

export interface TierInput {
  quantity: number;
  uncapped?: boolean;
}

export interface DerivedBracket {
  min: number;
  max: number | null;
}

/**
 * Derives bracket ranges from sorted tier quantities.
 * Last tier gets max=null when uncapped, else max = would-be next min - 1 (but we treat last as uncapped by default).
 */
export function deriveBrackets(
  tiers: { quantity: number; uncapped?: boolean }[]
): DerivedBracket[] {
  const sorted = [...tiers]
    .filter((t) => !isNaN(t.quantity) && t.quantity >= 1)
    .sort((a, b) => a.quantity - b.quantity);

  return sorted.map((t, i) => {
    const isLast = i === sorted.length - 1;
    const uncapped = isLast && t.uncapped;
    const max =
      uncapped || isLast
        ? null
        : sorted[i + 1].quantity - 1;
    return { min: t.quantity, max };
  });
}

/**
 * Returns a human-readable bracket label, e.g. "2-2 items", "3-5 items", "6+ items".
 */
export function getBracketLabel(min: number, max: number | null): string {
  if (max == null) return `${min}+ items`;
  if (min === max) return `${min} item${min === 1 ? "" : "s"}`;
  return `${min}-${max} items`;
}

export interface ValidationError {
  index: number;
  message: string;
}

/**
 * Validates that tier quantities are strictly increasing and >= 1.
 * Returns array of errors; empty if valid.
 * index refers to position in the original tiers array.
 */
export function validateTiers(
  tiers: { quantity: string }[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  const parsed = tiers.map((t, i) => ({
    index: i,
    qty: parseInt(t.quantity, 10),
    raw: String(t.quantity).trim(),
  }));

  for (const p of parsed) {
    if (p.raw === "") continue;
    if (isNaN(p.qty) || p.qty < 1) {
      errors.push({ index: p.index, message: "Must be 1 or greater." });
    }
  }

  const withQty = parsed.filter((p) => p.raw !== "" && !isNaN(p.qty) && p.qty >= 1);
  const sorted = [...withQty].sort((a, b) => a.qty - b.qty);

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].qty >= sorted[i + 1].qty) {
      errors.push({
        index: sorted[i + 1].index,
        message: `Must be greater than ${sorted[i].qty}. Quantities must increase (e.g., 2, 3, 6).`,
      });
    }
  }

  return errors;
}

/**
 * Builds volumeTiers for DB from UI state, deriving quantityMax from bracket logic.
 */
export function buildVolumeTiersForDb(
  tiers: { quantity: string; uncapped?: boolean; discountType: string; discountValue: string }[]
): { quantity: number; quantityMax: number | null; discountType: string; discountValue: number }[] {
  const valid = tiers
    .map((t) => ({
      ...t,
      quantity: parseInt(t.quantity, 10),
    }))
    .filter((t) => !isNaN(t.quantity) && t.quantity >= 1);

  const sorted = [...valid].sort((a, b) => a.quantity - b.quantity);

  return sorted.map((t, i) => {
    const isLast = i === sorted.length - 1;
    const uncapped = isLast && t.uncapped;
    const quantityMax =
      uncapped || isLast ? null : sorted[i + 1].quantity - 1;

    return {
      quantity: t.quantity,
      quantityMax,
      discountType: t.discountType,
      discountValue: parseFloat(t.discountValue) || 0,
    };
  });
}
