import Link from "next/link";
import { FileUp, Lightbulb, Lock, Target } from "lucide-react";
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

export default async function Home() {
  const session = await auth();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-mark">CF</div>
          <span className="landing-nav-name">Cash Flow Forecaster</span>
        </div>
        {session ? (
          <Link className="btn-secondary" href="/dashboard">
            Go to your dashboard
          </Link>
        ) : (
          <Link className="btn-secondary" href="/login">
            Log in
          </Link>
        )}
      </nav>

      <section className="landing-hero">
        <span className="landing-eyebrow">Cash flow forecasting for small business</span>
        <h1>Stop guessing when cash runs low.</h1>
        <p>
          Most small businesses still manage cash flow by hand: a spreadsheet somebody updates
          when they remember to, a mental note about which invoices are late, and a gut feeling
          about whether payroll clears next week. That manual process breaks down fast — a missed
          update, a forgotten recurring expense, or a customer payment that lands two weeks late
          can turn a healthy balance into an overdraft with almost no warning. By the time someone
          notices, there&apos;s no time left to react — no room to delay a purchase, renegotiate a
          due date, or draw on a credit line before it&apos;s urgent. Cash Flow Forecaster replaces
          that guesswork with a living model of your business: enter your income and expenses
          once, and every chart, scenario, and warning updates automatically as your numbers
          change — so you see a cash crunch weeks before it happens, not the day it does.
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

      <section className="landing-visual card">
        <svg className="landing-chart" viewBox="0 0 700 240" preserveAspectRatio="none">
          <line x1="40" y1="30" x2="40" y2="200" stroke="var(--border)" strokeWidth="1" />
          <line x1="40" y1="200" x2="680" y2="200" stroke="var(--border)" strokeWidth="1" />
          <line x1="40" y1="130" x2="680" y2="130" stroke="var(--borderSoft)" strokeWidth="1" strokeDasharray="4 4" />
          <path
            d="M40,150 L140,110 L240,175 L340,190 L440,120 L540,90 L680,55"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M40,150 L140,110 L240,175 L340,190 L440,120 L540,90 L680,55 L680,200 L40,200 Z"
            fill="var(--accentSoft)"
            opacity="0.6"
          />
          {[
            [40, 150],
            [140, 110],
            [240, 175],
            [340, 190],
            [440, 120],
            [540, 90],
            [680, 55],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4.5" fill="var(--ink)" stroke="white" strokeWidth="1.5" />
          ))}
          <text x="240" y="207" fontSize="11" fill="var(--expense)" textAnchor="middle">
            thin week flagged
          </text>
          <line x1="240" y1="175" x2="240" y2="199" stroke="var(--expense)" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        <p className="landing-chart-caption">
          Illustrative example — your own forecast is built entirely from the income and expenses
          you add.
        </p>
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
        <div className="onboarding-steps landing-features-grid">
          {FEATURES.map((f) => (
            <div className="onboarding-step" key={f.title}>
              <h3>
                <span className="onboarding-step-icon">
                  <f.icon size={15} />
                </span>
                {f.title}
              </h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
