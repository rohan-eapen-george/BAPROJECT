"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useWorkspace } from "../app/assumptions-provider";

const pages = [
  { href: "/", label: "Home" },
  { href: "/patient-risk", label: "Patient risk" },
  { href: "/day-planner", label: "Day planner" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About & method" },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pages.find((page) => page.href === pathname) ?? pages[0];
  const { assumptions, updateAssumption, resetAssumptions, theme, toggleTheme, assumptionsOpen, setAssumptionsOpen } = useWorkspace();
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  function openAssumptions() {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAssumptionsOpen(true);
  }

  useEffect(() => {
    if (!assumptionsOpen) return;
    const focusable = () => drawerRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),a[href],select:not([disabled]),[tabindex]:not([tabindex='-1'])") ?? [];
    const timer = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAssumptionsOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = [...focusable()];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(timer);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [assumptionsOpen, setAssumptionsOpen]);

  return (
    <div className="theme-root" data-theme={theme}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="wordmark" href="/" aria-label="Daywell home">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>daywell</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {pages.map((page) => <Link key={page.href} href={page.href} aria-current={pathname === page.href ? "page" : undefined}>{page.label}</Link>)}
          </nav>
          <div className="header-actions">
            <button className="quiet-button theme-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
              <span aria-hidden="true">{theme === "light" ? "◐" : "☼"}</span><span className="theme-label">{theme === "light" ? "Dark" : "Light"}</span>
            </button>
            <button className="button button-small button-outline" type="button" onClick={openAssumptions}><span aria-hidden="true">⚙</span><span>Assumptions</span></button>
          </div>
        </div>
        <div className="mobile-nav-wrap">
          <label className="sr-only" htmlFor="mobile-page-select">Go to page</label>
          <select id="mobile-page-select" value={pathname} onChange={(event) => { window.location.href = event.target.value; }}>
            {pages.map((page) => <option value={page.href} key={page.href}>{page.label}</option>)}
          </select>
        </div>
      </header>

      <main className="main-content">
        <div className="breadcrumb"><span>Your workspace</span><span aria-hidden="true">/</span><strong>{active.label}</strong></div>
        {children}
      </main>

      <footer className="site-footer"><div className="footer-inner">
        <p><strong>Educational prototype using a public dataset. Not for real clinical use.</strong></p>
        <p>Everything runs in your browser; no patient data is uploaded.</p>
        <Link href="/about">Read about the method and its limits <span aria-hidden="true">↗</span></Link>
      </div></footer>

      {assumptionsOpen && <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssumptionsOpen(false); }}>
        <section ref={drawerRef} className="assumptions-drawer" role="dialog" aria-modal="true" aria-labelledby="assumptions-title" tabIndex={-1}>
          <div className="drawer-head"><div><p className="eyebrow">Shared workspace settings</p><h2 id="assumptions-title">Business assumptions</h2></div>
            <button className="icon-button" type="button" onClick={() => setAssumptionsOpen(false)} aria-label="Close assumptions">×</button>
          </div>
          <p className="drawer-intro">These values shape the recommendations. Amounts use unspecified planning units; the values are not measured clinic results.</p>
          <div className="assumption-fields">
            <AssumptionNumber label="Slot revenue" id="slot-revenue" value={assumptions.slot_revenue} suffix="per attended slot" onChange={(value) => updateAssumption("slot_revenue", value)} min={0} step={25} />
            <AssumptionNumber label="SMS cost" id="sms-cost" value={assumptions.sms_cost} suffix="per message" onChange={(value) => updateAssumption("sms_cost", value)} min={0} step={1} />
            <AssumptionPercent label="SMS effectiveness" id="sms-effectiveness" value={assumptions.sms_effectiveness} suffix="relative reduction in no-show probability after contact" onChange={(value) => updateAssumption("sms_effectiveness", value)} />
            <AssumptionNumber label="Call cost" id="call-cost" value={assumptions.call_cost} suffix="per patient call" onChange={(value) => updateAssumption("call_cost", value)} min={0} step={5} />
            <AssumptionPercent label="Call effectiveness" id="call-effectiveness" value={assumptions.call_effectiveness} suffix="relative reduction in no-show probability after contact" onChange={(value) => updateAssumption("call_effectiveness", value)} />
            <AssumptionNumber label="Daily call capacity" id="call-capacity" value={assumptions.daily_call_capacity} suffix="calls across all neighbourhoods on one calendar day" onChange={(value) => updateAssumption("daily_call_capacity", Math.floor(value))} min={0} step={1} />
            <AssumptionNumber label="Overflow cost" id="overflow-cost" value={assumptions.overflow_cost} suffix="per patient above capacity" onChange={(value) => updateAssumption("overflow_cost", value)} min={0} step={25} />
          </div>
          <div className="drawer-actions"><button type="button" className="button button-outline" onClick={resetAssumptions}>Reset to defaults</button><button type="button" className="button button-primary" onClick={() => setAssumptionsOpen(false)}>Done</button></div>
          <p className="drawer-note"><span className="assumption-tag">ASSUMPTION</span> Effectiveness means relative reduction after contact, not percentage-point reduction.</p>
        </section>
      </div>}
    </div>
  );
}

function AssumptionNumber({ label, id, value, suffix, onChange, min, step }: { label: string; id: string; value: number; suffix: string; onChange: (value: number) => void; min: number; step: number }) {
  return <div className="assumption-field"><div className="assumption-label-row"><label htmlFor={id}>{label}</label><span className="assumption-tag">ASSUMPTION</span></div><div className="input-with-prefix"><input id={id} type="number" min={min} step={step} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} /></div><small>{suffix}</small></div>;
}

function AssumptionPercent({ label, id, value, suffix, onChange }: { label: string; id: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return <div className="assumption-field"><div className="assumption-label-row"><label htmlFor={id}>{label}</label><span className="assumption-tag">ASSUMPTION</span></div><div className="range-value"><input id={id} type="range" min={0} max={0.8} step={0.01} value={value} onChange={(event) => onChange(Number(event.target.value))} /><output htmlFor={id}>{Math.round(value * 100)}%</output></div><small>{suffix}</small></div>;
}
