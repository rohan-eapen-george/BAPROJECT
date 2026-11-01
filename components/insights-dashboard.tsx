import modelComparison from "../public/data/model_comparison.json";
import brierScores from "../public/data/calibration_brier_scores.json";
import calibrationDeciles from "../public/data/calibration_by_decile.json";
import liftGain from "../public/data/lift_gain.json";
import precisionTop from "../public/data/precision_at_top_k.json";
import oddsRatios from "../public/data/logistic_odds_ratios.json";
import vifTable from "../public/data/vif.json";
import hypothesisTests from "../public/data/tests.json";
import contactBacktest from "../public/data/contact_policy_backtest.json";
import capacitySensitivity from "../public/data/contact_capacity_sensitivity.json";
import smsSensitivity from "../public/data/contact_sms_cost_sensitivity.json";
import overbookingBacktest from "../public/data/overbooking_backtest.json";
import overbookingSensitivity from "../public/data/overbooking_backtest_by_overflow_cost.json";
import { DataTable, JsonTable, PageHead, Takeaway } from "./ui";

function TableSection({ title, takeaway, data }: { title: string; takeaway: string; data: JsonTable }) {
  return <section className="insight-section"><div className="insight-section-head"><div><h2>{title}</h2><p className="insight-takeaway">{takeaway}</p></div></div><div className="card insight-table-card"><DataTable data={data} label={title} /></div></section>;
}

function Figure({ src, alt, caption, wide = false }: { src: string; alt: string; caption: string; wide?: boolean }) {
  return <figure className={`card figure-card ${wide ? "figure-wide" : ""}`}><img src={src} alt={alt} loading="lazy" /><figcaption>{caption}</figcaption></figure>;
}

export function InsightsDashboard() {
  return <>
    <PageHead eyebrow="Insights" title="The evidence behind the suggestions." description="Explore model performance, calibration, patient risk patterns, and scenario results from the grouped holdout test set." aside={<><span className="assumption-tag">ASSUMPTIONS</span><br />Contact and overbooking backtests use assumed costs and effectiveness. They are simulated decision scenarios, not measured treatment effects.</>} />

    <TableSection title="Model comparison" takeaway="The calibrated tree catches more no-shows at the 0.5 threshold, while its accuracy is lower because it flags more appointments as at risk." data={modelComparison as JsonTable} />
    <section className="insight-section"><div className="insight-section-head"><div><h2>Model shape & calibration</h2><p className="insight-takeaway">The ROC curve shows ranking performance; the calibration plot compares predicted risk with observed test-set no-show rates.</p></div></div>
      <div className="figures-grid"><Figure src="/data/figures/roc_curves.png" alt="ROC curves comparing five candidate models on the holdout test set" caption="ROC curves across the five candidate models." /><Figure src="/data/figures/calibration_plot.png" alt="Calibration curve comparing mean predicted probability with actual no-show rate" caption="Calibration for the selected tree; points nearer the diagonal align predicted and observed rates." /></div>
    </section>
    <TableSection title="Calibration by risk group" takeaway="Calibration is strongest when average predicted risk tracks the observed no-show rate across groups; small groups can vary." data={calibrationDeciles as JsonTable} />
    <TableSection title="Calibration score comparison" takeaway="A lower Brier score means predicted probabilities were closer to the observed outcomes overall." data={brierScores as JsonTable} />
    <TableSection title="Lift and gain" takeaway="The table shows how many observed no-shows are captured by reviewing patients from highest predicted risk downward." data={liftGain as JsonTable} />
    <TableSection title="Precision among the highest-risk patients" takeaway="This estimates the share of no-shows within the top 10%, 20%, and 30% of predicted risk on the holdout data." data={precisionTop as JsonTable} />

    <section className="insight-section"><div className="insight-section-head"><div><h2>What patterns appear in the data?</h2><p className="insight-takeaway">These charts describe associations in the historical dataset and should not be read as causes.</p></div></div>
      <div className="figures-grid"><Figure src="/data/figures/no_show_by_lead_time.png" alt="No-show rate by appointment lead time" caption="Observed no-show rate varies with the time between booking and appointment." /><Figure src="/data/figures/no_show_by_age_group.png" alt="No-show rate by patient age group" caption="Observed rates by age group in the cleaned dataset." /><Figure src="/data/figures/no_show_by_weekday.png" alt="No-show rate by appointment weekday" caption="Observed no-show rate by scheduled appointment weekday." /><Figure src="/data/figures/no_show_by_sms_received.png" alt="No-show rate for appointments with and without SMS received" caption="SMS receipt is confounded with appointment lead time and is not a causal estimate." /></div>
    </section>

    <TableSection title="Logistic regression odds ratios" takeaway="Odds ratios describe adjusted associations in the diagnostic model, holding its other included features fixed." data={oddsRatios as JsonTable} />
    <TableSection title="Variance inflation (VIF)" takeaway="Lower VIFs indicate less linear overlap among the retained predictors in this diagnostic model." data={vifTable as JsonTable} />
    <TableSection title="Hypothesis tests" takeaway="Read each p-value alongside the test and group comparison; statistical evidence does not establish a causal effect." data={hypothesisTests as JsonTable} />

    <section className="insight-section"><div className="insight-section-head"><div><h2>Decision scenarios</h2><p className="insight-takeaway">Backtests use realized test labels with the stated assumptions; the gains are simulated and depend on those assumptions.</p></div><span className="assumption-tag">ASSUMPTIONS</span></div>
      <Takeaway>SMS and call effectiveness, contact costs, slot revenue, and overflow penalties are inputs to the scenario analysis—not effects estimated from the data.</Takeaway>
      <div className="figures-grid"><Figure src="/data/figures/contact_policy_backtest.png" alt="Realized net benefit under four contact policies" caption="Contact policies compared using realized no-show labels and assumed effects." /><Figure src="/data/figures/overbooking_backtest.png" alt="Mean profit, overflow, and empty slots under overbooking policies" caption="Overbooking policies compared through simulated arrival outcomes." /><Figure src="/data/figures/overbooking_profit_by_overflow_cost.png" alt="Mean overbooking profit by policy and overflow cost" caption="Recommended booking choices vary with the assumed overflow cost." wide /></div>
    </section>
    <TableSection title="Contact policy backtest" takeaway="Net benefit is calculated from realized no-shows among contacted patients, scaled by the assumed contact effectiveness and cost." data={contactBacktest as JsonTable} />
    <TableSection title="Call-capacity sensitivity" takeaway="A larger assumed daily call capacity permits more calls, with corresponding changes in SMS counts and net benefit." data={capacitySensitivity as JsonTable} />
    <TableSection title="SMS-cost sensitivity" takeaway="The targeting comparison changes as the assumed SMS cost changes; this is a scenario, not a market-price estimate." data={smsSensitivity as JsonTable} />
    <TableSection title="Overbooking backtest" takeaway="Mean profit, overflow, and empty slots are estimated over repeated simulations using the test-set predictions and outcomes." data={overbookingBacktest as JsonTable} />
    <TableSection title="Overbooking by overflow-cost assumption" takeaway="The most profitable overbooking level depends on how costly an arrival beyond capacity is assumed to be." data={overbookingSensitivity as JsonTable} />
    <div className="limits-panel" style={{ marginTop: 27 }}><h2>Keep the assumptions in view.</h2><p>The historical records are useful for learning how analytics can support a decision. They do not establish what would happen if a clinic changed its reminder or overbooking policy.</p><p>Financial results shown here are illustrative and sensitive to the inputs in the shared Assumptions drawer.</p></div>
  </>;
}
