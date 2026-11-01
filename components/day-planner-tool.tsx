"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import sampleDayJson from "../public/data/sample_day.json";
import { compareContactPlans } from "../lib/planner";
import { EncodedFeatures, encodePatient, PatientInput, predictBatch } from "../lib/model";
import { ContactDecision, recommendContacts } from "../lib/recommend";
import { useModel } from "../lib/use-model";
import { useWorkspace } from "../app/assumptions-provider";
import { money, PageHead, percentage, TierChip } from "./ui";

type AppointmentRow = {
  patient: string;
  neighbourhood: string;
  features: EncodedFeatures;
  source: "sample" | "upload";
};
type SampleDay = { appointment_day: string; neighbourhood: string; capacity: number; rows: Array<Record<string, string | number>> };
const sample = sampleDayJson as SampleDay;
const requiredColumns = ["gender", "scheduled_day", "appointment_day", "age", "neighbourhood"];

function normHeader(header: string) {
  const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return ({
    patientid: "patient_id", appointmentid: "appointment_id",
    scheduledday: "scheduled_day", appointmentday: "appointment_day",
    priorappointments: "prior_appointments", priornoshows: "prior_no_shows",
    hipertension: "hypertension", handcap: "handicap", sms_received: "sms_received",
  } as Record<string, string>)[normalized] ?? normalized;
}

function parseFlag(value: string | undefined): boolean {
  return ["1", "yes", "true", "y", "t"].includes((value ?? "").trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number but received “${value}”.`);
  return parsed;
}

function calendarDate(value: string, label: string): Date {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`${label} needs a date in YYYY-MM-DD format.`);
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is not a valid date.`);
  return date;
}

function rowFromCsv(row: Record<string, string>, index: number, model: NonNullable<ReturnType<typeof useModel>["model"]>): AppointmentRow {
  const appointmentDate = calendarDate(row.appointment_day ?? "", "AppointmentDay");
  const scheduledDate = calendarDate(row.scheduled_day ?? "", "ScheduledDay");
  const leadDays = Math.round((appointmentDate.getTime() - scheduledDate.getTime()) / 86_400_000);
  if (leadDays < 0) throw new Error(`Row ${index + 2}: appointment date is before the scheduled date.`);
  const hourMatch = row.scheduled_day?.match(/(?:T|\s)(\d{1,2}):/);
  const scheduledHour = hourMatch ? Number(hourMatch[1]) : 9;
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const input: PatientInput = {
    age: parseNumber(row.age, Number.NaN), gender: row.gender ?? "F", neighbourhood: row.neighbourhood ?? "Other",
    leadDays, appointmentWeekday: weekdays[appointmentDate.getUTCDay()], scheduledHour,
    scholarship: parseFlag(row.scholarship), hypertension: parseFlag(row.hypertension), diabetes: parseFlag(row.diabetes),
    alcoholism: parseFlag(row.alcoholism), handicap: parseFlag(row.handicap), smsReceived: parseFlag(row.sms_received),
    priorAppointments: parseNumber(row.prior_appointments), priorNoShows: parseNumber(row.prior_no_shows),
  };
  if (!Number.isFinite(input.age) || input.age < 0 || input.age > 100) throw new Error(`Row ${index + 2}: age must be from 0 to 100.`);
  if ((input.priorNoShows ?? 0) > (input.priorAppointments ?? 0)) throw new Error(`Row ${index + 2}: earlier no-shows exceed earlier appointments.`);
  return {
    patient: row.patient_id?.trim() ? `Patient ${row.patient_id.trim()}` : `Appointment ${index + 1}`,
    neighbourhood: input.neighbourhood,
    features: encodePatient(input, model),
    source: "upload",
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function DayPlannerTool() {
  const { model, error: modelError } = useModel();
  const { assumptions } = useWorkspace();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [dayLabel, setDayLabel] = useState("");
  const [capacity, setCapacity] = useState(sample.capacity);
  const [maxExtra, setMaxExtra] = useState(Math.max(1, Math.ceil(sample.capacity * 0.2)));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const evaluated = useMemo(() => {
    if (!model || !rows.length) return null;
    const probabilities = predictBatch(rows.map((row) => row.features), model);
    const decisions = recommendContacts(probabilities, rows.map((row) => Boolean(row.features.sms_received)), assumptions, model.risk_tier_cutoffs);
    const adjusted = decisions.map((decision) => decision.probabilityAfterContact);
    const plans = compareContactPlans(capacity, probabilities, adjusted, assumptions, maxExtra);
    const ordered = rows.map((row, index) => ({ row, probability: probabilities[index], decision: decisions[index] }))
      .sort((a, b) => {
        const order = { call: 0, SMS: 1, none: 2 };
        return order[a.decision.action] - order[b.decision.action] || b.probability - a.probability;
      });
    const actions = decisions.reduce((count, decision) => {
      if (decision.action === "call") count.calls += 1;
      if (decision.action === "SMS") count.sms += 1;
      return count;
    }, { calls: 0, sms: 0 });
    const withContactRow = plans.withContacts.table[plans.withContacts.recommendedK];
    return { probabilities, decisions, plans, ordered, actions, withContactRow };
  }, [model, rows, assumptions, capacity, maxExtra]);

  function useSampleDay() {
    if (!model) return;
    const sampleRows = sample.rows.map((row, index) => ({
      patient: String(row.patient_label ?? `Sample patient ${index + 1}`),
      neighbourhood: String(row.neighbourhood ?? sample.neighbourhood),
      features: Object.fromEntries(model.input_features.map((feature) => [feature, Number(row[feature] ?? 0)])),
      source: "sample" as const,
    }));
    setRows(sampleRows);
    setDayLabel(`${sample.appointment_day} · ${sample.neighbourhood}`);
    setCapacity(sample.capacity);
    setMaxExtra(Math.max(1, Math.ceil(sample.capacity * 0.2)));
    setMessage("Sample day loaded. Its appointments come from the held-out test split.");
    setError("");
  }

  function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !model) return;
    setError(""); setMessage(""); setRows([]);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true, transformHeader: normHeader,
      complete: (result) => {
        if (result.errors.length) {
          setError(`Could not read CSV row ${result.errors[0].row ?? "?"}: ${result.errors[0].message}`);
          return;
        }
        const columns = result.meta.fields ?? [];
        const missing = requiredColumns.filter((column) => !columns.includes(column));
        if (missing.length) {
          setError(`Missing required columns: ${missing.join(", ")}. Download the template for the expected headers.`);
          return;
        }
        if (!result.data.length) { setError("This CSV has headers but no appointment rows."); return; }
        try {
          const parsed = result.data.map((row, index) => rowFromCsv(row, index, model));
          const dates = new Set(result.data.map((row) => calendarDate(row.appointment_day, "AppointmentDay").toISOString().slice(0, 10)));
          if (dates.size !== 1) throw new Error("Upload one calendar AppointmentDay at a time. Call capacity is shared across all neighbourhoods on that date.");
          const day = [...dates][0];
          setRows(parsed); setDayLabel(`${day} · uploaded appointments`); setCapacity(parsed.length);
          setMaxExtra(Math.max(1, Math.ceil(parsed.length * 0.2)));
          setMessage(`${parsed.length.toLocaleString()} appointment${parsed.length === 1 ? "" : "s"} prepared from this CSV. No data left your browser.`);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The CSV could not be prepared.");
        }
      },
    });
    event.target.value = "";
  }

  function downloadRecommendations() {
    if (!evaluated) return;
    const head = ["patient", "neighbourhood", "risk_probability", "risk_tier", "action", "expected_net_benefit", "risk_after_contact"];
    const data = evaluated.ordered.map(({ row, probability, decision }) => [
      row.patient, row.neighbourhood, probability.toFixed(6), decision.tier, decision.action, decision.expectedNetBenefit.toFixed(2), decision.probabilityAfterContact.toFixed(6),
    ]);
    const content = [head, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "daywell-recommendations.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  if (modelError) return <div className="message message-error" role="alert">{modelError}</div>;
  const chartRows = evaluated ? evaluated.plans.withContacts.table.map((row, index) => ({
    k: row.extraBookings,
    withContacts: row.expectedProfit,
    withoutContacts: evaluated.plans.withoutContacts.table[index].expectedProfit,
  })) : [];
  return <>
    <PageHead eyebrow="Day planner" title="Make room for a steadier clinic day." description="Load a test-set sample or upload one appointment day. The contact limit is shared across neighbourhoods; the planner shows the expected trade-off at each extra-booking level." aside={<span><span className="assumption-tag">ASSUMPTION</span><br />Profit reflects the editable slot-revenue and overflow-cost assumptions.</span>} />
    <section className="upload-area" aria-label="Choose sample day or upload appointments">
      <div><h2>Bring in a clinic day</h2><p>Upload a CSV with Gender, ScheduledDay, AppointmentDay, Age, and Neighbourhood. Binary health and reminder fields are optional and default to no.</p></div>
      <div className="upload-actions">
        <button className="button button-primary" type="button" onClick={useSampleDay} disabled={!model}>Use a sample day</button>
        <label className="button button-outline file-button">Upload CSV<input type="file" accept=".csv,text/csv" onChange={uploadFile} aria-label="Upload clinic day CSV" disabled={!model} /></label>
        <a className="button button-outline" href="/data/template.csv" download>Download template</a>
      </div>
    </section>
    {error && <p className="message message-error" role="alert">{error}</p>}
    {message && <p className="message message-info" role="status">{message}</p>}
    {rows.length > 0 && <>
      <div className="planner-toolbar" style={{ marginTop: 20 }}><div><span className="card-kicker">Selected group</span><h2 className="card-title">{dayLabel}</h2><p className="text-note">{rows.length.toLocaleString()} appointments · uploaded data is processed locally</p></div>
        <span className="assumption-tag">ASSUMPTIONS ACTIVE</span></div>
      <div className="planner-controls">
        <div className="field"><label htmlFor="clinic-capacity">Clinic capacity C</label><input id="clinic-capacity" type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(Math.max(1, Number(event.target.value) || 1))} /></div>
        <div className="field"><label htmlFor="max-extra">Maximum extra bookings K</label><input id="max-extra" type="number" min="0" step="1" value={maxExtra} onChange={(event) => setMaxExtra(Math.max(0, Number(event.target.value) || 0))} /></div>
        <p className="planner-caption">Calls are limited per calendar day across all neighbourhoods. The uploaded rows are treated as this planner's capacity group.</p>
      </div>
      {evaluated && <>
        <div className="metric-grid" aria-live="polite">
          <Metric label="Calls selected" value={evaluated.actions.calls.toLocaleString()} note={`Daily limit: ${assumptions.daily_call_capacity}`} />
          <Metric label="SMS reminders" value={evaluated.actions.sms.toLocaleString()} note="Only when the patient has not received one" />
          <Metric label="Extra bookings · after contact" value={String(evaluated.plans.withContacts.recommendedK)} note={`Without contacts: ${evaluated.plans.withoutContacts.recommendedK}`} />
          <Metric label="Expected profit · after contact" value={money(evaluated.withContactRow.expectedProfit)} note={`${evaluated.withContactRow.expectedOverflow.toFixed(1)} overflow · ${evaluated.withContactRow.expectedEmptySlots.toFixed(1)} empty slots`} />
        </div>
        <div className="planner-charts">
          <section className="card chart-card" aria-labelledby="profit-chart-title">
            <div className="chart-heading"><div><h2 id="profit-chart-title">Expected profit by extra bookings</h2><p>Exact Poisson-binomial distribution; extras use the booked group's average predicted risk.</p></div><div className="legend-inline"><span className="legend-dot"><i />After planned contact</span><span className="legend-dot"><i className="alt" />Without contact</span></div></div>
            <div role="img" aria-label="Line chart comparing expected profit for each number of extra bookings, with and without planned contacts" style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows} margin={{ top: 8, right: 12, left: 2, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="k" tick={{ fill: "var(--muted)", fontSize: 10 }} label={{ value: "Extra bookings (k)", position: "insideBottom", offset: -1, fontSize: 10, fill: "var(--muted)" }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} width={48} />
                <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(label) => `Extra bookings: ${label}`} contentStyle={{ background: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)", borderRadius: 10, fontSize: 11 }} />
                <Line type="monotone" dataKey="withContacts" name="After planned contact" stroke="var(--teal)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="withoutContacts" name="Without contact" stroke="#c5904c" strokeWidth={2} dot={false} strokeDasharray="5 4" />
              </LineChart></ResponsiveContainer>
            </div>
          </section>
        </div>
        <section className="planner-bottom">
          <div className="card table-card">
            <div className="table-header"><div><h2>Ranked patient actions</h2><p>Highest-priority calls first, then SMS and no contact.</p></div><button className="button button-outline button-small" type="button" onClick={downloadRecommendations}>Download CSV</button></div>
            <div className="table-scroll"><table className="data-table"><caption className="sr-only">Predicted appointment risk and recommended action</caption><thead><tr><th scope="col">Patient</th><th scope="col">Neighbourhood</th><th scope="col">No-show risk</th><th scope="col">Tier</th><th scope="col">Action</th><th scope="col">Expected net</th></tr></thead>
              <tbody>{evaluated.ordered.map(({ row, probability, decision }, index) => <tr key={`${row.patient}-${index}`}><td>{row.patient}</td><td>{row.neighbourhood}</td><td className="numeric">{percentage(probability, 1)}</td><td className="tier-cell"><TierChip tier={decision.tier} /></td><td>{decision.action === "none" ? "No contact" : decision.action}</td><td className="numeric">{money(decision.expectedNetBenefit)}</td></tr>)}</tbody>
            </table></div>
          </div>
          <aside className="planner-note"><strong>How to read this plan</strong><br />The best extra-booking count is the k with the highest expected profit under the current assumptions. The exact distribution treats appointment arrivals as independent. Contact effects are simulated relative reductions in no-show probability; the charts compare the booked patients before and after the planned calls and SMS.</aside>
        </section>
      </>}
    </>}
    {!rows.length && <div className="card card-pad" style={{ marginTop: 17 }}><p className="text-note" style={{ margin: 0 }}>Choose the sample day or upload a CSV to see patient actions and an overbooking curve.</p></div>}
    <p className="text-note" style={{ marginTop: 14 }}><span className="assumption-tag">ASSUMPTION</span> Results depend on the configured costs and effectiveness; these values are not measured treatment effects.</p>
  </>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="card metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
