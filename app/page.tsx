import Link from "next/link";
import { ArrowUpRight, FileUp, Lightbulb, Lock, Target, TrendingDown } from "lucide-react";
import { auth } from "@/auth";

const OLD_WAY = [
  "Manually updated, so it's often stale by the time anyone looks at it",
  "Easy to forget one-off or irregular expenses — insurance, quarterly taxes, equipment",
  "No easy way to test \"what if\" scenarios without duplicating the whole sheet",
  "Warning signs only show up after someone happens to check the balance",
];

const NEW_WAY = [
  "One place to log income and expenses — the forecast updates instantly as they change",
  "Recurring items (weekly, biweekly, monthly) are tracked automatically, so nothing slips through",
  "Built-in bear / base / bull scenarios show a range of outcomes, not just one guess",
  "Automatic insights flag negative weeks and thin cash buffers before they happen",
];

const STEPS = [
  {
    num: "1",
    title: "Add your numbers",
    text: "Enter income and expenses one at a time, or import a CSV in bulk if you're already tracking them in a spreadsheet.",
  },
  {
    num: "2",
    title: "Get your forecast",
    text: "See your weekly cash trajectory, inflows vs. outflows, and a full ledger — built entirely from your own data.",
  },
  {
    num: "3",
    title: "Act before it's urgent",
    text: "Scenario planning and automatic insights flag risk weeks in advance, while there's still time to do something about it.",
  },
];

const FEATURES = [
  { icon: Lock, title: "Private by company", text: "Every account gets its own isolated forecast — nothing is shared or mixed between companies." },
  { icon: FileUp, title: "Bulk CSV import", text: "Already tracking things in a spreadsheet? Upload it once and populate your whole forecast in one go." },
  { icon: Target, title: "Scenario planning", text: "Compare bear, base, and bull revenue scenarios side by side on the same chart." },
  { icon: Lightbulb, title: "Automatic insights", text: "Get plain-English warnings about negative weeks and thin buffers, generated from your own numbers." },
];

const COLOR = { ink: "#0E1016", inkMuted: "#62697A", border: "#E7E8F0", income: "#0EA672", expense: "#E5484D" };

// ---- illustrative preview chart geometry (static SVG, no client-side chart library needed) ----

function buildAreaChart(values: number[], w: number, h: number, padT: number, padB: number) {
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const stepX = w / (n - 1);
  const pts = values.map((v, i) => [i * stepX, padT + (h - padT - padB) * (1 - (v - min) / range)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${h - padB} L${pts[0][0].toFixed(1)},${h - padB} Z`;
  const dipIndex = values.indexOf(Math.min(...values.slice(1)));
  return { pts, line, area, dipIndex };
}

const PREVIEW_W = 400;
const PREVIEW_H = 130;
const PREVIEW_BALANCES = [14000, 15600, 12800, 17200, 20400, 25900, 31900, 40800];
const preview = buildAreaChart(PREVIEW_BALANCES, PREVIEW_W, PREVIEW_H, 8, 6);

const BAR_W = 380;
const BAR_H = 150;
const BAR_WEEKS = [
  { in: 5000, out: 800 },
  { in: 5000, out: 0 },
  { in: 5000, out: 3800 },
  { in: 5000, out: 0 },
  { in: 5000, out: 800 },
  { in: 5000, out: 0 },
  { in: 5000, out: 800 },
  { in: 5000, out: 3000 },
];
const barPadT = 8, barPadB = 6, barPlotH = BAR_H - barPadT - barPadB;
const barMax = Math.max(...BAR_WEEKS.flatMap((w) => [w.in, w.out]));
const barBw = BAR_W / BAR_WEEKS.length;
const barYFor = (v: number) => barPadT + barPlotH * (1 - v / barMax);

const SCEN_W = 380;
const SCEN_H = 150;
const SCEN_BASE = [10000, 15200, 14400, 21700, 26800, 33300, 38800, 40800];
const SCEN_BULL = SCEN_BASE.map((v, i) => Math.round(v * (1 + i * 0.012)));
const SCEN_BEAR = SCEN_BASE.map((v, i) => Math.round(v * (1 - i * 0.014)));
function scenarioPath(values: number[]) {
  const min = Math.min(...SCEN_BEAR);
  const max = Math.max(...SCEN_BULL);
  const range = max - min || 1;
  const padT = 8, padB = 6;
  const plotH = SCEN_H - padT - padB;
  const stepX = SCEN_W / (values.length - 1);
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(padT + plotH * (1 - (v - min) / range)).toFixed(1)}`).join(" ");
}

export default async function Home() {
  const session = await auth();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-mark">CF</div>
          <span className="landing-nav-name">Cash Flow Forecaster</span>
        </div>
        <div className="landing-nav-cta">
          <div className="brand-mark" aria-hidden="true">CF</div>
          {session ? (
            <Link className="btn-secondary" href="/dashboard">
              Go to your dashboard
            </Link>
          ) : (
            <Link className="btn-secondary" href="/login">
              Log in
            </Link>
          )}
        </div>
      </nav>

      <div className="landing-hero-wrap">
        <section className="landing-hero">
          <span className="landing-eyebrow">Cash flow forecasting for small business</span>
          <h1>
            Stop guessing when <em>cash runs low</em>.
          </h1>
          <p>
            Most small businesses still manage cash flow by hand: a spreadsheet somebody updates
            when they remember to, a mental note about which invoices are late, and a gut feeling
            about whether payroll clears next week. Cash Flow Forecaster replaces that guesswork
            with a living model of your business — enter your income and expenses once, and every
            chart, scenario, and warning updates automatically as your numbers change, so you see
            a cash crunch weeks before it happens, not the day it does.
          </p>
          <div className="landing-ctas">
            {session ? (
              <Link className="btn-primary" href="/dashboard">
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link className="btn-primary" href="/signup">
                  Create your account
                </Link>
                <Link className="btn-secondary" href="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </section>

        <div className="card landing-preview" aria-hidden="true">
          <div className="landing-preview-head">
            <span>Live preview</span>
            <div className="landing-preview-dots">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="landing-preview-kpis">
            <div className="landing-preview-kpi up">
              <span>
                <ArrowUpRight size={11} /> Ending balance
              </span>
              <strong>$40,800</strong>
            </div>
            <div className="landing-preview-kpi">
              <span>
                <TrendingDown size={11} /> Lowest balance
              </span>
              <strong>$12,800</strong>
            </div>
          </div>
          <svg className="landing-preview-chart" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none">
            <path d={preview.area} fill="var(--accentSoft)" opacity="0.7" />
            <path d={preview.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {preview.pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === preview.dipIndex ? 4 : 2.5} fill={i === preview.dipIndex ? COLOR.expense : COLOR.ink} stroke="white" strokeWidth="1.2" />
            ))}
          </svg>
          <p className="landing-preview-caption">Illustrative — your forecast is built from the numbers you add</p>
        </div>
      </div>

      <section className="landing-gallery">
        <h2>Every angle of your cash flow, at a glance</h2>
        <div className="landing-gallery-grid">
          <div className="card landing-gallery-card">
            <h3>Weekly inflows vs. outflows</h3>
            <p>See exactly which weeks are heavy on expenses before they arrive.</p>
            <svg className="landing-gallery-chart" viewBox={`0 0 ${BAR_W} ${BAR_H}`} preserveAspectRatio="none">
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" y1={barPadT + barPlotH * f} x2={BAR_W} y2={barPadT + barPlotH * f} stroke={COLOR.border} strokeWidth="1" />
              ))}
              {BAR_WEEKS.map((w, i) => {
                const groupX = i * barBw;
                const barW = barBw * 0.32;
                const gap = barBw * 0.06;
                const xIn = groupX + barBw * 0.15;
                const xOut = xIn + barW + gap;
                const yIn = barYFor(w.in);
                const yOut = barYFor(w.out);
                return (
                  <g key={i}>
                    <rect x={xIn} y={yIn} width={barW} height={barPadT + barPlotH - yIn} fill={COLOR.income} rx="2" />
                    <rect x={xOut} y={yOut} width={barW} height={barPadT + barPlotH - yOut} fill={COLOR.expense} rx="2" />
                  </g>
                );
              })}
            </svg>
            <div className="landing-gallery-legend">
              <span><i style={{ background: COLOR.income }} /> Inflows</span>
              <span><i style={{ background: COLOR.expense }} /> Outflows</span>
            </div>
          </div>

          <div className="card landing-gallery-card">
            <h3>Bear · base · bull scenarios</h3>
            <p>Stress-test a slow month against your plan without duplicating a sheet.</p>
            <svg className="landing-gallery-chart" viewBox={`0 0 ${SCEN_W} ${SCEN_H}`} preserveAspectRatio="none">
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" y1={8 + (SCEN_H - 14) * f} x2={SCEN_W} y2={8 + (SCEN_H - 14) * f} stroke={COLOR.border} strokeWidth="1" />
              ))}
              <path d={scenarioPath(SCEN_BEAR)} fill="none" stroke={COLOR.expense} strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={scenarioPath(SCEN_BASE)} fill="none" stroke={COLOR.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={scenarioPath(SCEN_BULL)} fill="none" stroke={COLOR.income} strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="landing-gallery-legend">
              <span><i style={{ background: COLOR.expense }} /> Bear</span>
              <span><i style={{ background: COLOR.ink }} /> Base</span>
              <span><i style={{ background: COLOR.income }} /> Bull</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-problem">
        <h2>The old way vs. Cash Flow Forecaster</h2>
        <div className="landing-compare">
          <div className="landing-compare-col landing-compare-old">
            <h3>Manual spreadsheet tracking</h3>
            <ul>
              {OLD_WAY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="landing-compare-col landing-compare-new">
            <h3>With Cash Flow Forecaster</h3>
            <ul>
              {NEW_WAY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-steps">
        <h2>How it works</h2>
        <div className="landing-steps-grid">
          {STEPS.map((step) => (
            <div className="landing-step" key={step.num}>
              <div className="landing-step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-features-grid">
          {FEATURES.map((f, i) => (
            <div className="landing-feature" key={f.title}>
              <div className="landing-feature-num">{String(i + 1).padStart(2, "0")}</div>
              <h3>
                <f.icon size={14} />
                {f.title}
              </h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-copy">© {new Date().getFullYear()} Cash Flow Forecaster</span>
        <div className="landing-footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
