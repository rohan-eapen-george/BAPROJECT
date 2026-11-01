import { PageHead, SectionTitle } from "../../components/ui";

const syllabus = [
  { n: "01", title: "Descriptive analytics", text: "Summarize attendance patterns by age group, weekday, lead time, and SMS receipt." },
  { n: "02", title: "Data preparation", text: "Clean dates and values, create appointment history features, group neighbourhoods, and split by patient." },
  { n: "03", title: "Predictive analytics", text: "Fit and compare classification models; assess discrimination, error trade-offs, and probability calibration." },
  { n: "04", title: "Business interpretation", text: "Use logistic odds ratios and VIF as diagnostic tools, with care around association and collinearity." },
  { n: "05", title: "Prescriptive analytics", text: "Compare contact choices and booking levels against explicit operating assumptions." },
  { n: "06", title: "Simulation & sensitivity", text: "Use Poisson-binomial planning and backtests to explore uncertainty and the impact of changed assumptions." },
];

export default function AboutPage() {
  return <>
    <PageHead eyebrow="About & method" title="A learning tool for clinic operations." description="Daywell turns a business analytics project into a small, transparent workflow: estimate appointment risk, compare follow-up choices, and examine possible day plans." />
    <div className="about-grid">
      <article className="card about-copy"><div className="section-label">The question</div><h2 className="section-title">How can a clinic plan around missed appointments?</h2>
        <p>No-shows can leave staff and appointment capacity unused. This project explores how historical appointment patterns might inform patient-level risk estimates and day-level planning.</p>
        <p>The website uses the pre-trained calibrated decision tree from the project. It runs in your browser: form entries and uploaded appointment CSVs are processed locally and are not sent to a server.</p>
        <p>The model is a decision aid for coursework. Its risk tiers are relative ranks based on the training distribution, not clinical categories or certainty about an individual person.</p>
      </article>
      <aside className="card source-card"><span className="card-kicker">Data source</span><h2>Kaggle Medical Appointment No Shows</h2><p>Appointment records from Vitória, Brazil, collected in 2016. The website uses the project's cleaned, patient-grouped training and test split and the exported model and analysis artifacts.</p></aside>
    </div>

    <section className="section-block"><SectionTitle eyebrow="Mapped to the course" title="Business analytics, from description to decision" description="Each stage connects a familiar analytics method to an operating question." />
      <div className="syllabus-list">{syllabus.map((item) => <article className="card syllabus-item" key={item.n}><span>{item.n}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>

    <section className="section-block limits-panel" aria-labelledby="limits-title">
      <h2 id="limits-title">Assumptions & limitations</h2>
      <p>Use the shared Assumptions control to explore different values. The default costs, slot revenue, and contact effectiveness are clearly labeled assumptions throughout the app.</p>
      <ul>
        <li>SMS and call effectiveness are assumed relative reductions in no-show probability, not measured effects from this dataset.</li>
        <li>Financial costs, slot revenue, overflow penalty, and call capacity are planning assumptions; conclusions change when these inputs change.</li>
        <li>Observed relationships are associations. The model does not show that changing any feature will cause attendance to change.</li>
        <li>SMS receipt is confounded with lead time and may reflect how reminders were assigned; its observed association is not a treatment effect.</li>
        <li>The exact planner assumes appointment attendance outcomes are independent. Real clinic-day outcomes may be correlated.</li>
        <li>Backtest contact effects are simulated from assumed effectiveness and realized test-set no-show labels; they are not measured interventions.</li>
        <li>The analysis uses one public dataset from Vitória, Brazil, in 2016. It may not represent other clinics, populations, or current practice.</li>
        <li>This educational prototype is not intended for real patient care, operational deployment, or clinical decision-making.</li>
      </ul>
    </section>
  </>;
}
