import Link from "next/link";
import { SectionTitle } from "../components/ui";

const steps = [
  { number: "01", icon: "⌕", title: "Predict", text: "Estimate a patient's chance of missing a visit, using patterns in past appointments." },
  { number: "02", icon: "↗", title: "Act", text: "Compare a reminder, a call, or no contact using clear cost and effectiveness assumptions." },
  { number: "03", icon: "▥", title: "Plan", text: "Explore how a few extra bookings could balance empty slots and possible overflow." },
];

export default function Home() {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">A calmer way to plan the clinic day</p>
        <h1 className="display-title">Fewer empty chairs.<br /><span>Calmer clinics.</span></h1>
        <p className="subhead">Understand appointment no-show risk, choose sensible follow-up, and explore day-level booking plans with a little more confidence.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/patient-risk">Try the patient risk tool <span aria-hidden="true">→</span></Link>
          <Link className="button button-outline" href="/day-planner">Plan a clinic day</Link>
        </div>
      </div>
      <div className="hero-aside" aria-label="Illustration of an empty clinic chair ready for the next patient" role="img">
        <div className="hero-illustration" aria-hidden="true"><div className="sun" /><div className="chair" /><div className="seat" /></div>
        <div className="hero-note"><b>A little better prepared</b>One thoughtful plan at a time</div>
      </div>
    </section>
    <section aria-label="How Daywell works">
      <div className="section-block" style={{ marginTop: 0 }}><SectionTitle eyebrow="A simple three-step view" title="From patient patterns to a steadier day" description="A small decision aid for learning about clinic operations, business analytics, and the assumptions behind both." /></div>
      <div className="steps-grid">
        {steps.map((step) => <article className="card step-card" key={step.number}>
          <div className="step-top"><span className="step-number">{step.number}</span><span className="step-icon" aria-hidden="true">{step.icon}</span></div>
          <h3>{step.title}</h3><p>{step.text}</p>
        </article>)}
      </div>
    </section>
    <section className="home-cta" aria-label="Get started">
      <div><h2>Start with one patient or one clinic day.</h2><p>Use the sample data or bring a CSV. Your inputs stay in this browser.</p></div>
      <Link className="button" href="/day-planner">Open the day planner <span aria-hidden="true">→</span></Link>
    </section>
  </>;
}
