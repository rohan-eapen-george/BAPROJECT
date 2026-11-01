import { Assumptions } from "./recommend";

function validateProbabilities(probabilities: number[]): void {
  if (probabilities.some((p) => !Number.isFinite(p) || p < 0 || p > 1)) {
    throw new Error("Probabilities must be finite values in [0, 1].");
  }
}

/** Exact count distribution for independent Bernoulli trials, via convolution. */
export function poissonBinomial(showProbabilities: number[]): number[] {
  validateProbabilities(showProbabilities);
  let distribution = [1];
  for (const p of showProbabilities) {
    const next = Array(distribution.length + 1).fill(0) as number[];
    for (let shows = 0; shows < distribution.length; shows += 1) {
      next[shows] += distribution[shows] * (1 - p);
      next[shows + 1] += distribution[shows] * p;
    }
    distribution = next;
  }
  return distribution;
}

export type OverbookingRow = {
  extraBookings: number;
  expectedServed: number;
  expectedOverflow: number;
  expectedEmptySlots: number;
  expectedProfit: number;
};

export type OverbookingPlan = { recommendedK: number; table: OverbookingRow[] };

export function planOverbooking(
  capacity: number,
  bookedNoShowProbabilities: number[],
  assumptions: Assumptions,
  extraNoShowProbability = bookedNoShowProbabilities.length
    ? bookedNoShowProbabilities.reduce((sum, p) => sum + p, 0) / bookedNoShowProbabilities.length
    : 0,
  maxExtraBookings = Math.max(1, Math.ceil(capacity * 0.2)),
): OverbookingPlan {
  if (!Number.isInteger(capacity) || capacity < 0) throw new Error("Capacity must be a non-negative integer.");
  if (!Number.isInteger(maxExtraBookings) || maxExtraBookings < 0) throw new Error("Maximum extra bookings must be a non-negative integer.");
  validateProbabilities(bookedNoShowProbabilities);
  validateProbabilities([extraNoShowProbability]);

  let distribution = poissonBinomial(bookedNoShowProbabilities.map((p) => 1 - p));
  const extraShowProbability = 1 - extraNoShowProbability;
  const table: OverbookingRow[] = [];
  for (let k = 0; k <= maxExtraBookings; k += 1) {
    let expectedServed = 0;
    let expectedOverflow = 0;
    let expectedEmptySlots = 0;
    for (let shows = 0; shows < distribution.length; shows += 1) {
      const probability = distribution[shows];
      expectedServed += probability * Math.min(shows, capacity);
      expectedOverflow += probability * Math.max(shows - capacity, 0);
      expectedEmptySlots += probability * Math.max(capacity - shows, 0);
    }
    table.push({
      extraBookings: k,
      expectedServed,
      expectedOverflow,
      expectedEmptySlots,
      expectedProfit: assumptions.slot_revenue * expectedServed - assumptions.overflow_cost * expectedOverflow,
    });
    if (k < maxExtraBookings) {
      const next = Array(distribution.length + 1).fill(0) as number[];
      for (let shows = 0; shows < distribution.length; shows += 1) {
        next[shows] += distribution[shows] * (1 - extraShowProbability);
        next[shows + 1] += distribution[shows] * extraShowProbability;
      }
      distribution = next;
    }
  }
  const recommendedK = table.reduce((best, row) => row.expectedProfit > best.expectedProfit ? row : best, table[0]).extraBookings;
  return { recommendedK, table };
}

/** Compare the exact planner before and after applying the recommended contacts. */
export function compareContactPlans(
  capacity: number,
  baseNoShowProbabilities: number[],
  adjustedNoShowProbabilities: number[],
  assumptions: Assumptions,
  maxExtraBookings?: number,
): { withoutContacts: OverbookingPlan; withContacts: OverbookingPlan } {
  if (baseNoShowProbabilities.length !== adjustedNoShowProbabilities.length) throw new Error("Contact-adjusted probabilities must match booked patients.");
  const averageP = baseNoShowProbabilities.length
    ? baseNoShowProbabilities.reduce((sum, p) => sum + p, 0) / baseNoShowProbabilities.length
    : 0;
  return {
    withoutContacts: planOverbooking(capacity, baseNoShowProbabilities, assumptions, averageP, maxExtraBookings),
    withContacts: planOverbooking(capacity, adjustedNoShowProbabilities, assumptions, averageP, maxExtraBookings),
  };
}
