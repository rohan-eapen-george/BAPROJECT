"use client";

import { FormEvent, useState } from "react";
import { explainRisk } from "../lib/reasons";
import { PatientInput, predictPatient } from "../lib/model";
import { recommendContacts } from "../lib/recommend";
import { useModel } from "../lib/use-model";
import { useWorkspace } from "../app/assumptions-provider";
import { money, PageHead, percentage, Skeleton, TierChip } from "./ui";

const initial: PatientInput = {
  age: 39, gender: "F", neighbourhood: "JARDIM CAMBURI", leadDays: 15,
  appointmentWeekday: "Wednesday", scheduledHour: 9, scholarship: false,
  hypertension: false, diabetes: false, alcoholism: false, handicap: false,
  smsReceived: false, priorAppointments: 2, priorNoShows: 0,
};
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type PatientResult = { probability: number; tier: string; action: string; benefit: number; after: number; reasons: ReturnType<typeof explainRisk> };

export function PatientRiskTool() {
  const { model, loading, error: modelError } = useModel();
  const { assumptions } = useWorkspace();
  const [form, setForm] = useState<PatientInput>(initial);
  const [result, setResult] = useState<PatientResult | null>(null);
  const [formError, setFormError] = useState("");

  function update<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!model) return;
    if ((form.priorNoShows ?? 0) > (form.priorAppointments ?? 0)) {
      setFormError("Earlier no-shows cannot be greater than earlier appointments.");
      return;
    }
    try {
      const scored = predictPatient(form, model);
      const policy = recommendContacts([scored.probability], [Boolean(form.smsReceived)], assumptions, model.risk_tier_cutoffs)[0];
      setResult({
        probability: scored.probability, tier: policy.tier, action: policy.action,
        benefit: policy.expectedNetBenefit, after: policy.probabilityAfterContact,
        reasons: explainRisk(scored.features, model, 3),
      });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Check the patient information and try again.");
    }
  }

  return <>
    <PageHead eyebrow="Patient risk" title="A clearer view of one appointment." description="Enter a few appointment and patient details to see the model's calibrated estimate, the path behind it, and a cost-aware follow-up suggestion." aside={<><strong>Private by design.</strong> Your entries stay in this browser and are not saved or uploaded.</>} />
    {modelError && <div className="message message-error" role="alert">{modelError}</div>}
    <div className="tool-grid">
      <form className="card form-card" onSubmit={submit}>
        <div className="form-card-head"><h2>Appointment details</h2><p>Use broad, non-identifying details. Patient names and IDs are not needed.</p></div>
        <div className="form-grid">
          <p className="form-section-title">Patient & appointment</p>
          <div className="field"><label htmlFor="patient-age">Age</label><input id="patient-age" type="number" min="0" max="100" required value={form.age} onChange={(event) => update("age", Number(event.target.value))} /></div>
          <div className="field"><label htmlFor="patient-gender">Gender</label><select id="patient-gender" value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="F">Female</option><option value="M">Male</option></select></div>
          <div className="field"><label htmlFor="patient-neighbourhood">Neighbourhood</label><select id="patient-neighbourhood" value={form.neighbourhood} onChange={(event) => update("neighbourhood", event.target.value)}>
            {(model?.categorical_encodings.neighbourhood_grouped ?? ["Other"]).filter((value) => value !== "Other").map((value) => <option key={value} value={value}>{value}</option>)}<option value="Other">Other / not listed</option>
          </select><small className="field-help">Unlisted neighbourhoods are grouped as Other by the model.</small></div>
          <div className="field"><label htmlFor="patient-lead">Booked how many days ahead?</label><input id="patient-lead" type="number" min="0" max="365" required value={form.leadDays} onChange={(event) => update("leadDays", Number(event.target.value))} /></div>
          <div className="field"><label htmlFor="patient-weekday">Appointment weekday</label><select id="patient-weekday" value={form.appointmentWeekday} onChange={(event) => update("appointmentWeekday", event.target.value)}>{days.map((day) => <option key={day}>{day}</option>)}</select></div>
          <div className="field"><label htmlFor="patient-hour">Scheduled hour</label><select id="patient-hour" value={form.scheduledHour} onChange={(event) => update("scheduledHour", Number(event.target.value))}>{Array.from({ length: 13 }, (_, index) => index + 7).map((hour) => <option value={hour} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></div>

          <p className="form-section-title">Appointment history</p>
          <div className="field"><label htmlFor="prior-appointments">Earlier appointments</label><input id="prior-appointments" type="number" min="0" max="100" value={form.priorAppointments} onChange={(event) => update("priorAppointments", Number(event.target.value))} /></div>
          <div className="field"><label htmlFor="prior-no-shows">Earlier no-shows</label><input id="prior-no-shows" type="number" min="0" max={form.priorAppointments} value={form.priorNoShows} onChange={(event) => update("priorNoShows", Number(event.target.value))} /><small className="field-help">Must be no greater than earlier appointments.</small></div>
          <div className="toggle-field"><input id="sms-received" type="checkbox" checked={Boolean(form.smsReceived)} onChange={(event) => update("smsReceived", event.target.checked)} /><label htmlFor="sms-received">SMS already received</label></div>

          <p className="form-section-title">Health & support indicators</p>
          {([
            ["scholarship", "Scholarship"], ["hypertension", "Hypertension"], ["diabetes", "Diabetes"],
            ["alcoholism", "Alcoholism"], ["handicap", "Handicap"],
          ] as const).map(([key, label]) => <div className="toggle-field" key={key}><input id={`patient-${key}`} type="checkbox" checked={Boolean(form[key])} onChange={(event) => update(key, event.target.checked)} /><label htmlFor={`patient-${key}`}>{label}</label></div>)}
        </div>
        {formError && <p className="message message-error" role="alert">{formError}</p>}
        <div className="form-actions"><button className="button button-primary" type="submit" disabled={loading || !model}>Calculate risk <span aria-hidden="true">→</span></button><button className="button-text" type="button" onClick={() => { setForm(initial); setResult(null); setFormError(""); }}>Reset form</button></div>
      </form>

      {loading ? <section className="card loading-result" aria-busy="true" aria-label="Loading calibrated model"><Skeleton /><Skeleton /><Skeleton /><p className="text-note">Loading the calibrated model in your browser…</p></section> : result ? <ResultCard result={result} /> : <section className="card result-card">
        <div className="result-top"><p className="card-kicker">Your appointment snapshot</p><h2>Risk estimate</h2><div className="result-probability"><strong>—</strong><span>complete the form to see the result</span></div></div>
        <div className="result-body"><p className="text-note">The estimate is a pattern from historical data, not a certainty about an individual appointment.</p><div className="result-section"><h3>What you’ll see</h3><p className="text-note">A relative risk tier, the main rules along the model path, and an action suggestion based on the current assumptions.</p></div></div>
      </section>}
    </div>
  </>;
}

function ResultCard({ result }: { result: PatientResult }) {
  const actionText = result.action === "none" ? "No contact" : result.action === "SMS" ? "Send an SMS" : "Make a call";
  const actionIcon = result.action === "none" ? "·" : result.action === "SMS" ? "✉" : "☎";
  return <section className="card result-card" aria-live="polite">
    <div className="result-top"><p className="card-kicker">Your appointment snapshot</p><h2>Calibrated no-show probability</h2><div className="result-probability"><strong>{percentage(result.probability, 1)}</strong><span>estimated chance of a no-show</span></div>
      <div className="result-tier-row"><TierChip tier={result.tier} /><span className="result-tier-caption">Tiers are relative: High = top third of patients</span></div>
    </div>
    <div className="result-body">
      <div className="result-section"><h3>What is shaping this estimate</h3>
        {result.reasons.length ? <ul className="reason-list">{result.reasons.map((reason, index) => <li className="reason-item" key={`${reason.feature}-${index}`}><span className="reason-rule">{reason.rule}</span><span className={`reason-effect ${reason.contributionPp >= 0 ? "positive" : "negative"}`}>{reason.contributionPp >= 0 ? "+" : "−"}{Math.abs(reason.contributionPp).toFixed(1)} pp</span></li>)}</ul> : <p className="text-note">No single path rule stood out for this appointment.</p>}
        <p className="text-note" style={{ margin: "10px 0 0" }}>Path contributions describe model patterns; they are not causes.</p>
      </div>
      <div className="result-section"><h3>Suggested next step</h3><div className="action-summary"><div className="action-name"><span className="action-icon" aria-hidden="true">{actionIcon}</span>{actionText}</div><div className="action-money">{money(result.benefit)}<small>expected net benefit</small></div></div>
        <p className="text-note" style={{ margin: "10px 0 0" }}>Expected no-show risk after this action: <strong>{percentage(result.after, 1)}</strong></p>
      </div>
    </div>
  </section>;
}
