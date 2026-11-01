export type ModelArtifact = {
  input_features: string[];
  transformed_feature_names: string[];
  numeric_transform: { features: string[]; mean: number[]; scale: number[] };
  categorical_encodings: Record<string, string[]>;
  neighbourhood_grouping: { retained_neighbourhoods: string[] };
  risk_tier_cutoffs: { low_medium: number; medium_high: number; method: string };
  members: Array<{
    tree: {
      children_left: number[];
      children_right: number[];
      feature: number[];
      threshold: number[];
      value: number[][][];
      n_node_samples: number[];
      weighted_n_node_samples: number[];
      classes: number[];
    };
    calibrator:
      | { method: "isotonic"; x_thresholds: number[]; y_thresholds: number[]; out_of_bounds: string }
      | { method: "sigmoid"; a: number; b: number };
  }>;
};

export type EncodedFeatures = Record<string, number>;

export type PatientInput = {
  age: number;
  gender: string;
  neighbourhood: string;
  leadDays: number;
  appointmentWeekday: string;
  scheduledHour: number;
  scholarship?: number | boolean;
  hypertension?: number | boolean;
  diabetes?: number | boolean;
  alcoholism?: number | boolean;
  handicap?: number | boolean;
  smsReceived?: number | boolean;
  priorAppointments?: number;
  priorNoShows?: number;
};

const NUMERIC_INPUTS: Array<[keyof PatientInput, string]> = [
  ["age", "age"],
  ["scholarship", "scholarship"],
  ["hypertension", "hypertension"],
  ["diabetes", "diabetes"],
  ["alcoholism", "alcoholism"],
  ["handicap", "handicap"],
  ["smsReceived", "sms_received"],
  ["leadDays", "lead_days"],
  ["scheduledHour", "scheduled_hour"],
  ["priorNoShows", "prior_no_shows"],
  ["priorAppointments", "prior_appointments"],
];

function numeric(value: number | boolean | undefined, feature: string): number {
  const result = typeof value === "boolean" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(result)) throw new Error(`${feature} must be a finite number.`);
  return result;
}

function ageGroup(age: number): string {
  if (age <= 17) return "0-17";
  if (age <= 29) return "18-29";
  if (age <= 44) return "30-44";
  if (age <= 59) return "45-59";
  if (age <= 74) return "60-74";
  return "75-100";
}

/** Convert form or raw CSV values to the exact one-hot model input order. */
export function encodePatient(input: PatientInput, model: ModelArtifact): EncodedFeatures {
  if (input.age < 0 || input.age > 100) throw new Error("Age must be between 0 and 100.");
  const row: EncodedFeatures = Object.fromEntries(model.input_features.map((name) => [name, 0]));
  for (const [sourceName, targetName] of NUMERIC_INPUTS) {
    if (targetName in row) row[targetName] = numeric(input[sourceName] as number | boolean | undefined, targetName);
  }

  const categories: Record<string, string> = {
    gender: input.gender.trim().toUpperCase(),
    neighbourhood_grouped: model.neighbourhood_grouping.retained_neighbourhoods.includes(input.neighbourhood)
      ? input.neighbourhood
      : "Other",
    appointment_weekday: input.appointmentWeekday,
    age_group: ageGroup(input.age),
  };
  for (const [prefix, value] of Object.entries(categories)) {
    const key = `${prefix}_${value}`;
    if (key in row) row[key] = 1;
  }
  return row;
}

function scaledFeatures(row: EncodedFeatures, model: ModelArtifact): number[] {
  return model.transformed_feature_names.map((name) => {
    const value = row[name];
    if (!Number.isFinite(value)) throw new Error(`Missing or invalid model input: ${name}`);
    const numericIndex = model.numeric_transform.features.indexOf(name);
    const transformed = numericIndex < 0
      ? value
      : (value - model.numeric_transform.mean[numericIndex]) / model.numeric_transform.scale[numericIndex];
    // sklearn's decision tree casts the transformed matrix to float32 before routing.
    return Math.fround(transformed);
  });
}

export function traverseTree(row: EncodedFeatures, member: ModelArtifact["members"][number], model: ModelArtifact): {
  rawProbability: number;
  path: number[];
} {
  const values = scaledFeatures(row, model);
  const tree = member.tree;
  const path: number[] = [];
  let node = 0;
  while (true) {
    path.push(node);
    const left = tree.children_left[node];
    const right = tree.children_right[node];
    if (left === right || left < 0 || right < 0) break;
    const feature = tree.feature[node];
    node = values[feature] <= tree.threshold[node] ? left : right;
  }
  const classIndex = tree.classes.indexOf(1);
  if (classIndex < 0) throw new Error("The exported tree does not contain the no-show class.");
  const counts = tree.value[node][0];
  // sklearn exports node values as normalized class proportions; preserve the
  // stored float exactly because isotonic calibration can jump at those values.
  return { rawProbability: counts[classIndex], path };
}

export function calibrateProbability(probability: number, calibrator: ModelArtifact["members"][number]["calibrator"]): number {
  if (calibrator.method === "sigmoid") {
    const z = calibrator.a * probability + calibrator.b;
    return 1 / (1 + Math.exp(z));
  }
  const xs = calibrator.x_thresholds;
  const ys = calibrator.y_thresholds;
  if (probability <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (probability >= xs[last]) return ys[last];
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (xs[middle] <= probability) low = middle;
    else high = middle;
  }
  const fraction = (probability - xs[low]) / (xs[high] - xs[low]);
  return ys[low] + fraction * (ys[high] - ys[low]);
}

export function predictProbability(row: EncodedFeatures, model: ModelArtifact): number {
  if (model.members.length === 0) throw new Error("The model artifact has no calibrated ensemble members.");
  const sum = model.members.reduce((total, member) => {
    const raw = traverseTree(row, member, model).rawProbability;
    return total + calibrateProbability(raw, member.calibrator);
  }, 0);
  return sum / model.members.length;
}

export function predictPatient(input: PatientInput, model: ModelArtifact): { features: EncodedFeatures; probability: number } {
  const features = encodePatient(input, model);
  return { features, probability: predictProbability(features, model) };
}

export function predictBatch(rows: EncodedFeatures[], model: ModelArtifact): number[] {
  return rows.map((row) => predictProbability(row, model));
}
