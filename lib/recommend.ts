export type Assumptions = {
  slot_revenue: number;
  sms_cost: number;
  sms_effectiveness: number;
  call_cost: number;
  call_effectiveness: number;
  daily_call_capacity: number;
  overflow_cost: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  slot_revenue: 500,
  sms_cost: 2,
  sms_effectiveness: 0.1,
  call_cost: 40,
  call_effectiveness: 0.3,
  daily_call_capacity: 20,
  overflow_cost: 300,
};

export type ContactDecision = {
  probability: number;
  tier: "Low" | "Medium" | "High";
  action: "none" | "SMS" | "call";
  expectedNetBenefit: number;
  callIncrementalBenefit: number;
  probabilityAfterContact: number;
};

export function riskTier(probability: number, lowMedium: number, mediumHigh: number): ContactDecision["tier"] {
  if (probability < lowMedium) return "Low";
  if (probability < mediumHigh) return "Medium";
  return "High";
}

function validate(probability: number, assumptions: Assumptions): void {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error("Risk probability must be in [0, 1].");
  for (const [key, value] of Object.entries(assumptions)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a finite non-negative value.`);
  }
  if (assumptions.sms_effectiveness > 1 || assumptions.call_effectiveness > 1) throw new Error("Effectiveness must be between 0 and 1.");
}

/** Daily call capacity is shared by all appointments in the supplied clinic day. */
export function recommendContacts(
  probabilities: number[],
  smsAlreadyReceived: boolean[],
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
  tierCutoffs: { low_medium: number; medium_high: number } = { low_medium: 0.1007, medium_high: 0.268 },
): ContactDecision[] {
  if (probabilities.length !== smsAlreadyReceived.length) throw new Error("Each patient needs an SMS-received flag.");
  probabilities.forEach((probability) => validate(probability, assumptions));
  if (!Number.isInteger(assumptions.daily_call_capacity)) throw new Error("daily_call_capacity must be an integer.");

  const smsBenefit = probabilities.map((p) => p * assumptions.sms_effectiveness * assumptions.slot_revenue - assumptions.sms_cost);
  const callBenefit = probabilities.map((p) => p * assumptions.call_effectiveness * assumptions.slot_revenue - assumptions.call_cost);
  const incremental = probabilities.map((p, i) => smsAlreadyReceived[i]
    ? callBenefit[i]
    : p * (assumptions.call_effectiveness - assumptions.sms_effectiveness) * assumptions.slot_revenue - (assumptions.call_cost - assumptions.sms_cost));
  const action: ContactDecision["action"][] = probabilities.map(() => "none");
  const expectedNetBenefit = probabilities.map(() => 0);

  const callCandidates = probabilities.map((_, index) => index)
    .filter((index) => callBenefit[index] > 0 && incremental[index] > 0)
    .sort((a, b) => incremental[b] - incremental[a]);
  const calls = callCandidates.slice(0, assumptions.daily_call_capacity);
  for (const index of calls) {
    action[index] = "call";
    expectedNetBenefit[index] = callBenefit[index];
  }

  const called = new Set(calls);
  for (let index = 0; index < probabilities.length; index += 1) {
    if (called.has(index) || smsAlreadyReceived[index] || smsBenefit[index] <= 0) continue;
    action[index] = "SMS";
    expectedNetBenefit[index] = smsBenefit[index];
  }

  return probabilities.map((probability, index) => {
    const effect = action[index] === "call" ? assumptions.call_effectiveness : action[index] === "SMS" ? assumptions.sms_effectiveness : 0;
    return {
      probability,
      tier: riskTier(probability, tierCutoffs.low_medium, tierCutoffs.medium_high),
      action: action[index],
      expectedNetBenefit: expectedNetBenefit[index],
      callIncrementalBenefit: incremental[index],
      probabilityAfterContact: probability * (1 - effect),
    };
  });
}
