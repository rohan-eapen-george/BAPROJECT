import { EncodedFeatures, ModelArtifact } from "./model";
import { traverseTree } from "./model";

export type RiskReason = {
  feature: string;
  rule: string;
  direction: "higher" | "lower";
  contributionPp: number;
  explanation: string;
};

const FRIENDLY: Record<string, string> = {
  age: "Age",
  lead_days: "Booking lead time",
  scheduled_hour: "Appointment time",
  prior_no_shows: "Earlier no-shows",
  prior_appointments: "Earlier appointments",
  scholarship: "Scholarship",
  hypertension: "Hypertension",
  diabetes: "Diabetes",
  alcoholism: "Alcoholism",
  handicap: "Handicap",
  sms_received: "SMS already received",
};

function categoryName(feature: string): string {
  const prefix = ["neighbourhood_grouped_", "appointment_weekday_", "age_group_", "gender_"].find((item) => feature.startsWith(item));
  return prefix ? feature.slice(prefix.length) : feature;
}

function rangeRule(feature: string, conditions: Array<{ threshold: number; right: boolean }>): string {
  if (feature.startsWith("neighbourhood_grouped_") || feature.startsWith("appointment_weekday_") || feature.startsWith("age_group_") || feature.startsWith("gender_")) {
    const value = categoryName(feature);
    const isCategory = conditions.every((condition) => condition.right);
    const categoryLabel = feature.startsWith("neighbourhood_grouped_") ? "Neighbourhood" :
      feature.startsWith("appointment_weekday_") ? "Appointment weekday" :
      feature.startsWith("age_group_") ? "Age group" : "Gender";
    return `${categoryLabel} ${isCategory ? "is" : "is not"} ${value}`;
  }
  const name = FRIENDLY[feature] ?? feature.replaceAll("_", " ");
  let lower = Number.NEGATIVE_INFINITY;
  let upper = Number.POSITIVE_INFINITY;
  for (const condition of conditions) {
    // These model inputs are whole-day/hour/count values. Convert a split into
    // the nearest whole values that actually satisfy the path condition.
    if (condition.right) lower = Math.max(lower, Math.floor(condition.threshold) + 1);
    else upper = Math.min(upper, Math.floor(condition.threshold));
  }
  if (feature === "scholarship" || feature === "hypertension" || feature === "diabetes" || feature === "alcoholism" || feature === "handicap" || feature === "sms_received") {
    const saysYes = conditions[conditions.length - 1].right;
    return `${name}: ${saysYes ? "yes" : "no"}`;
  }
  const unit = feature === "lead_days" ? " days ahead" : feature === "age" ? " years" : feature === "scheduled_hour" ? ":00" : "";
  if (Number.isFinite(lower) && Number.isFinite(upper)) return `${name} between ${lower}${unit} and ${upper}${unit}`;
  if (Number.isFinite(lower)) return feature === "prior_no_shows" ? `${lower}+ earlier no-shows` : `${name} at least ${lower}${unit}`;
  if (Number.isFinite(upper)) return `${name} up to ${upper}${unit}`;
  return name;
}

/** Aggregate each path's node-share changes by feature, then describe the top three. */
export function explainRisk(row: EncodedFeatures, model: ModelArtifact, topN = 3): RiskReason[] {
  const numericPositions = new Map(model.numeric_transform.features.map((feature, i) => [feature, i]));
  const groups = new Map<string, { contribution: number; rules: Map<string, number> }>();

  // The calibrated model averages five cross-validation trees. Average the
  // node-share contributions over those paths, while selecting the most common
  // rounded path rule to keep the explanation readable.
  for (const member of model.members) {
    const { path } = traverseTree(row, member, model);
    const tree = member.tree;
    const memberGroups = new Map<string, { contribution: number; conditions: Array<{ threshold: number; right: boolean }> }>();
    for (let index = 0; index < path.length - 1; index += 1) {
      const parent = path[index];
      const child = path[index + 1];
      const featureIndex = tree.feature[parent];
      if (featureIndex < 0) continue;
      const feature = model.transformed_feature_names[featureIndex];
      const parentRisk = tree.value[parent][0][tree.classes.indexOf(1)];
      const childRisk = tree.value[child][0][tree.classes.indexOf(1)];
      const item = memberGroups.get(feature) ?? { contribution: 0, conditions: [] };
      item.contribution += childRisk - parentRisk;
      let threshold = tree.threshold[parent];
      const numericIndex = numericPositions.get(feature);
      if (numericIndex !== undefined) {
        threshold = threshold * model.numeric_transform.scale[numericIndex] + model.numeric_transform.mean[numericIndex];
      }
      item.conditions.push({ threshold, right: child === tree.children_right[parent] });
      memberGroups.set(feature, item);
    }

    for (const [feature, item] of memberGroups) {
      const aggregate = groups.get(feature) ?? { contribution: 0, rules: new Map<string, number>() };
      aggregate.contribution += item.contribution / model.members.length;
      const rule = rangeRule(feature, item.conditions);
      aggregate.rules.set(rule, (aggregate.rules.get(rule) ?? 0) + 1);
      groups.set(feature, aggregate);
    }
  }

  return [...groups.entries()]
    .map(([feature, item]) => {
      const contributionPp = item.contribution * 100;
      const direction = contributionPp >= 0 ? "higher" : "lower";
      const rule = [...item.rules.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const magnitude = Math.abs(contributionPp);
      return {
        feature,
        rule,
        direction,
        contributionPp,
        explanation: `${rule} is associated with ${direction} modeled no-show risk by about ${magnitude.toFixed(1)} percentage points along this tree path.`,
      } satisfies RiskReason;
    })
    .sort((a, b) => Math.abs(b.contributionPp) - Math.abs(a.contributionPp))
    .slice(0, Math.max(0, topN));
}
