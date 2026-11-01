import { ReactNode } from "react";

export function PageHead({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return <div className="page-head"><div className="page-head-copy"><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1><p className="subhead">{description}</p></div>{aside && <div className="page-head-aside">{aside}</div>}</div>;
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div>{eyebrow && <div className="section-label">{eyebrow}</div>}<h2 className="section-title">{title}</h2>{description && <p className="section-copy">{description}</p>}</div>;
}

export function TierChip({ tier }: { tier: string }) {
  const className = tier.toLowerCase() === "high" ? "tier-high" : tier.toLowerCase() === "medium" ? "tier-medium" : "tier-low";
  return <span className={`tier-chip ${className}`}>{tier}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function money(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} units`;
}

export function percentage(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export type JsonTable = { columns: string[]; rows: Array<Record<string, string | number | boolean | null>> };
const PERCENT_COLUMNS = /(^|_)(auc|accuracy|precision|recall|f1|rate|capture|probability|effectiveness|fraction|lift)$/i;
const FRIENDLY_HEADERS: Record<string, string> = {
  cv_auc_mean: "CV AUC (mean)", cv_auc_std: "CV AUC (SD)", test_roc_auc: "Test ROC-AUC", test_pr_auc: "Test PR-AUC",
  evaluation_threshold: "Threshold", no_show_rate: "No-show rate", cumulative_capture: "Cumulative no-shows captured",
  capture_rate: "No-shows captured", precision_at_top_k: "Precision at top risk", top_risk_fraction: "Top-risk share",
  expected_profit: "Expected profit", mean_profit: "Mean profit", expected_overflow: "Expected overflow",
  expected_empty_slots: "Expected empty slots", overflow_cost: "Overflow cost", no_contact: "No contact", risk_tier: "Risk tier",
};

function headerName(value: string) {
  if (FRIENDLY_HEADERS[value]) return FRIENDLY_HEADERS[value];
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(column: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (PERCENT_COLUMNS.test(column) && value >= 0 && value <= 1) return percentage(value, 1);
    if (Number.isInteger(value)) return new Intl.NumberFormat("en-US").format(value);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  }
  return String(value);
}

export function DataTable({ data, label, maxRows }: { data: JsonTable; label: string; maxRows?: number }) {
  const rows = maxRows ? data.rows.slice(0, maxRows) : data.rows;
  return <div className="table-scroll"><table className="data-table"><caption className="sr-only">{label}</caption><thead><tr>{data.columns.map((column) => <th scope="col" key={column}>{headerName(column)}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{data.columns.map((column) => <td className={typeof row[column] === "number" ? "numeric" : ""} key={column}>{displayValue(column, row[column])}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function Takeaway({ children }: { children: ReactNode }) {
  return <p className="takeaway-callout"><strong>In plain English: </strong>{children}</p>;
}
