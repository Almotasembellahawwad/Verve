import type { GeneratedProject } from "@/lib/project/types";
import { PUBLIC_DEMO_BRIEF, PUBLIC_DEMO_RESULT } from "@/lib/demo/public-demo";
import { civicResult, fashionResult, learningResult } from "@/lib/demo/public-demo-v3";
import measuredVisualTruth from "@/data/public-demo-visual-truth.json";

export type PublicDemoVisualTruthEvidence = (typeof measuredVisualTruth.examples)[keyof typeof measuredVisualTruth.examples];
export const PUBLIC_DEMO_DIVERSITY_THRESHOLD = measuredVisualTruth.releaseDistanceThreshold;

export type PublicDemoReceipt = {
  engineVersion: "3.0.0-beta";
  direction: {
    creativityClass: "combinational" | "exploratory" | "transformational";
    experienceModel: string;
    topology: string;
    opening: string;
    navigation: string;
  };
  fingerprint: {
    occupancy: string;
    colorRhythm: string;
    mediaRatio: number;
    interactionDensity: number;
  };
  abstractReferences: { near: string; remote: [string, string]; antiReference: string };
  assets: { manifest: "ASSETS.md"; policy: string };
  tests: { viewports: [360, 768, 1440]; criticalAccessibility: 0; horizontalOverflow: 0 };
  nearestExampleDistance: number;
  measurement: PublicDemoVisualTruthEvidence;
};

type AuthoredPublicDemoReceipt = Omit<PublicDemoReceipt, "measurement" | "nearestExampleDistance">;

function receipt(input: Omit<AuthoredPublicDemoReceipt, "engineVersion" | "assets" | "tests">): AuthoredPublicDemoReceipt {
  return {
    engineVersion: "3.0.0-beta",
    assets: { manifest: "ASSETS.md", policy: "Local, user-owned, approved, or programmatically generated assets only." },
    tests: { viewports: [360, 768, 1440], criticalAccessibility: 0, horizontalOverflow: 0 },
    ...input,
  };
}

const architectureBrief = "A London architecture practice focused on adaptive reuse. The public demo must feel investigative and material, present conceptual studies honestly, and invite developers to begin a feasibility study.";

const architectureHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Reframe is a fictional adaptive-reuse architecture practice created as a Verve public demo.">
  <title>Reframe / Adaptive reuse studies</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip" href="#main">Skip to the work</a>
  <header class="topbar">
    <a class="mark" href="#main" aria-label="Reframe home">R/<sup>17</sup></a>
    <p>Adaptive reuse practice<br>London · public demo</p>
    <nav aria-label="Primary navigation"><a href="#register">Studies</a><a href="#method">Method</a></nav>
    <button type="button" class="index-toggle" aria-expanded="false" aria-controls="project-index" data-index-toggle>Open index</button>
  </header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <figure class="hero-image"><img src="/demo-assets/reframe-retention-study.webp" alt="Weathered London industrial building with a translucent adaptive-reuse insertion"><figcaption>Generated material study / fictional site / 2026</figcaption></figure>
      <div class="datum" aria-hidden="true" style="font-size:10px"><span>51°30′N</span><i></i><span>0°07′W</span></div>
      <p class="eyebrow">Existing fabric / future use / less extraction</p>
      <h1 id="hero-title" data-verve-task="primary-object">The building<br><em>already knows.</em></h1>
      <div class="hero-note" data-verve-task="decision-evidence"><b>01 / Position</b><p>We begin with what is load-bearing, weathered, useful—and worth keeping. New architecture follows the evidence.</p></div>
      <a class="down" href="#register" data-verve-primary-action>Read the fabric <span aria-hidden="true">↓</span></a>
    </section>
    <section class="register" id="register" aria-labelledby="register-title">
      <header><p>Retention register / conceptual work</p><h2 id="register-title">Three ways to<br>keep more.</h2><small>All studies below are fictional and created for this interactive Verve demo.</small></header>
      <ol id="project-index">
        <li><span>01 / Power</span><div><h3>River turbine hall</h3><p>Housing inserted around a retained gantry and brick thermal shell.</p></div><strong>74% fabric retained*</strong></li>
        <li><span>02 / Civic</span><div><h3>North archive</h3><p>A municipal store reopened as workshops around its concrete frame.</p></div><strong>Frame kept in place*</strong></li>
        <li><span>03 / Street</span><div><h3>Seven shopfronts</h3><p>One continuous home assembled behind seven repaired thresholds.</p></div><strong>Zero façades removed*</strong></li>
      </ol>
      <p class="footnote">*Illustrative targets for fictional concept studies, not completed-project claims.</p>
    </section>
    <section class="method" id="method" aria-labelledby="method-title">
      <div class="method-rule" aria-hidden="true"><span>Survey</span><span>Test</span><span>Alter</span></div>
      <div><p>02 / Working method</p><h2 id="method-title">Draw last.</h2></div>
      <div class="method-copy"><p>Every commission starts with a retention map: structure, memory, carbon, access, and the useful accidents no new brief could invent.</p><p>Only then do we decide what must change.</p></div>
    </section>
    <section class="contact" aria-labelledby="contact-title">
      <p>Have a building before you have a brief?</p>
      <h2 id="contact-title">Let the evidence<br>set the direction.</h2>
      <a href="mailto:studio@example.com">Begin a study <span aria-hidden="true">↗</span></a>
      <small>Demo contact only · replace before publishing</small>
    </section>
  </main>
  <script src="script.js"></script>
</body>
</html>`;

const architectureCss = `:root{--concrete:#d4d3cd;--ink:#11120f;--blue:#1647ff;--rust:#a7442f;--line:rgba(17,18,15,.25);font-family:Arial,"Segoe UI",sans-serif;color:var(--ink);background:var(--concrete)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--concrete);color:var(--ink)}a{color:inherit}.skip{position:fixed;left:12px;top:12px;z-index:20;padding:12px 16px;background:#fff;transform:translateY(-180%)}.skip:focus{transform:none}.topbar{min-height:92px;display:grid;grid-template-columns:1fr 1fr auto auto;align-items:center;gap:38px;padding:0 clamp(20px,4vw,64px);border-bottom:1px solid var(--line)}.mark{font-size:2rem;font-weight:900;letter-spacing:-.08em;text-decoration:none}.mark sup{color:var(--blue);font-size:.45em}.topbar p{margin:0;font-size:.68rem;line-height:1.4;text-transform:uppercase;letter-spacing:.08em}.topbar nav{display:flex;gap:24px}.topbar nav a{font-size:.78rem;text-decoration:none}.index-toggle{min-height:44px;border:1px solid var(--ink);background:transparent;padding:0 16px;color:inherit;cursor:pointer}.hero{position:relative;min-height:calc(100vh - 92px);padding:clamp(46px,7vw,100px) clamp(20px,6vw,92px);overflow:hidden}.eyebrow{margin:0 0 8vh;padding-left:27%;font-size:.66rem;letter-spacing:.13em;text-transform:uppercase}.hero h1{position:relative;z-index:2;margin:0;font-size:clamp(4.8rem,13vw,12rem);font-weight:900;line-height:.73;letter-spacing:-.09em}.hero h1 em{color:var(--blue);font-family:Georgia,serif;font-weight:400}.datum{position:absolute;left:25%;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--rust);font-size:.62rem;letter-spacing:.1em;writing-mode:vertical-rl}.datum i{width:1px;flex:1;background:var(--rust)}.hero-note{position:absolute;right:6vw;bottom:9vh;width:min(320px,30vw);border-top:5px solid var(--ink);padding-top:14px}.hero-note b{font-size:.65rem;letter-spacing:.12em}.hero-note p{font-family:Georgia,serif;font-size:1.05rem;line-height:1.55}.down{position:absolute;left:6vw;bottom:9vh;text-decoration:none;font-size:.72rem;font-weight:700}.register{padding:clamp(72px,10vw,150px) clamp(20px,6vw,92px);background:var(--ink);color:var(--concrete)}.register>header{display:grid;grid-template-columns:1fr 2fr 1fr;align-items:end;gap:30px;margin-bottom:70px}.register header p,.method>div>p,.contact>p{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase}.register h2,.method h2,.contact h2{margin:0;font-size:clamp(3.4rem,8vw,8rem);line-height:.82;letter-spacing:-.075em}.register header small{color:#9b9b94;line-height:1.6}.register ol{margin:0;padding:0;list-style:none}.register li{display:grid;grid-template-columns:160px 1fr auto;align-items:center;gap:26px;padding:30px 0;border-top:1px solid rgba(212,211,205,.22);transition:color .2s,transform .2s}.register li:last-child{border-bottom:1px solid rgba(212,211,205,.22)}.register li span{color:#8b8b84;font-size:.7rem}.register h3{margin:0 0 8px;font-size:clamp(1.6rem,3vw,3rem);letter-spacing:-.04em}.register li p{margin:0;color:#aaa9a2}.register strong{color:#7d98ff;font-size:.72rem}.register.index-open li{color:#fff;transform:translateX(8px)}.footnote{margin-top:16px;color:#8b8b84;font-size:.68rem}.method{min-height:86vh;display:grid;grid-template-columns:1fr 1.4fr 1fr;align-items:center;gap:6vw;padding:clamp(72px,10vw,150px) clamp(20px,6vw,92px);border-bottom:1px solid var(--line)}.method-rule{align-self:stretch;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid var(--rust);padding:20px;color:var(--rust);font-size:.65rem;text-transform:uppercase;letter-spacing:.1em}.method-rule span:nth-child(2){align-self:center}.method-rule span:last-child{align-self:flex-end}.method-copy{align-self:end;margin-bottom:8vh}.method-copy p{font-family:Georgia,serif;font-size:1.15rem;line-height:1.65}.contact{min-height:82vh;padding:clamp(72px,10vw,150px) clamp(20px,6vw,92px);background:var(--blue);color:#f0f0e9}.contact h2{margin:13vh 0 8vh;font-size:clamp(4rem,11vw,10rem)}.contact>a{display:inline-block;border-bottom:1px solid;padding:0 0 8px;text-decoration:none;font-size:1.1rem}.contact small{display:block;margin-top:16px;color:#bdc9ff}@media(max-width:760px){.topbar{grid-template-columns:1fr auto;gap:16px}.topbar p,.topbar nav{display:none}.hero{min-height:760px}.eyebrow{padding-left:18%;margin-bottom:11vh}.hero h1{font-size:clamp(4.2rem,22vw,7rem)}.datum{left:18%}.hero-note{right:20px;bottom:12vh;width:58vw}.down{bottom:5vh}.register>header,.method{grid-template-columns:1fr}.register header small{max-width:40ch}.register li{grid-template-columns:70px 1fr}.register strong{grid-column:2}.method{min-height:auto}.method-rule{min-height:180px}.method-copy{margin:0}.contact h2{font-size:clamp(3.8rem,17vw,6rem)}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}`;

const architectureCssV2 = `${architectureCss}\n.hero-image{position:absolute;z-index:0;inset:10% 0 0 38%;margin:0;overflow:hidden;background:#9b9990}.hero-image:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--concrete) 0%,transparent 34%,rgba(17,18,15,.08) 100%)}.hero-image img{width:100%;height:100%;object-fit:cover;filter:saturate(.76) contrast(1.05)}.hero-image figcaption{position:absolute;z-index:1;right:18px;bottom:16px;padding:8px 10px;background:rgba(17,18,15,.8);color:#f0f0e9;font-size:.625rem;letter-spacing:.08em;text-transform:uppercase}.hero .eyebrow,.hero h1,.hero-note{position:relative;z-index:2}.down{z-index:3}@media(min-width:761px){.hero h1{max-width:72%;font-size:clamp(4.8rem,9vw,8.5rem);line-height:.76;text-shadow:0 1px 0 var(--concrete)}.hero-note{position:absolute;right:4vw;width:min(280px,23vw);background:rgba(212,211,205,.92);padding:14px}.eyebrow{margin-bottom:6vh}.datum{left:2.5vw;top:4%;bottom:4%}}@media(max-width:760px){.hero-image{inset:31% 0 16% 22%}.hero-image:after{background:linear-gradient(180deg,var(--concrete),transparent 30%,rgba(17,18,15,.12))}.hero-image figcaption{max-width:170px}.hero-note{background:rgba(212,211,205,.9);padding:10px}.down{top:calc(100vh - 190px);bottom:auto}}`;

// Keep the position note anchored to the image at every width. The broad
// layering rule in V2 accidentally returned it to normal flow on mobile.
const architectureCssV3 = `${architectureCssV2}\n.hero .hero-note{position:absolute;z-index:2}`;

const architectureScript = `const toggle=document.querySelector('[data-index-toggle]');const register=document.querySelector('#register');toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Close index':'Open index';register?.classList.toggle('index-open',open);});`;

const architectureProject: GeneratedProject = {
  schemaVersion: 1,
  name: "reframe-london-adaptive-reuse",
  framework: "html",
  entryFile: "index.html",
  files: [
    { path: "index.html", content: architectureHtml, language: "html", role: "source" },
    { path: "styles.css", content: architectureCssV3, language: "css", role: "source" },
    { path: "script.js", content: architectureScript, language: "javascript", role: "source" },
    { path: "README.md", content: "# Reframe — Verve public demo\n\nA hand-curated, dependency-free adaptive-reuse architecture reference for Verve's public gallery. All projects and figures are explicitly fictional. Open `index.html` or serve the folder with a static server.\n", language: "markdown", role: "documentation" },
    { path: "ASSETS.md", content: "# Asset manifest\n\n- Typography: local system grotesk and Georgia; no remote font request.\n- Survey datum and diagrams: generated in CSS; Verve-authored.\n- `public/demo-assets/reframe-retention-study.webp`: original AI-generated architectural material study created for Verve; no external brand, model, or stock license.\n- The pictured site and project are fictional and must not be represented as completed client work.\n", language: "markdown", role: "documentation" },
  ],
  dependencies: {}, scripts: {}, warnings: [],
  readiness: { status: "ready", score: 97 },
  validation: { status: "ready", score: 97, checks: [], failed: 0, warnings: 0 },
};

const architectureResult = {
  ...PUBLIC_DEMO_RESULT,
  briefAnalysis: { subject: "Adaptive-reuse architecture practice", audience: "London developers and owners of existing buildings", primaryJob: "Understand the practice's point of view and begin a feasibility study", tone: "Investigative, material, exact, optimistic", industry: "Architecture / Adaptive reuse" },
  plan: {
    colorPalette: [{ name: "Concrete", hex: "#D4D3CD", role: "background" }, { name: "Survey Ink", hex: "#11120F", role: "text / dark surface" }, { name: "Blueprint", hex: "#1647FF", role: "primary signal" }, { name: "Oxide", hex: "#A7442F", role: "datum accent" }],
    typePairing: { display: "Arial Black / system grotesk", body: "Arial / Georgia", rationale: "Hard working drawings meet reflective editorial notes without an external font dependency." },
    layoutConcept: "A retention register turns an architecture portfolio into evidence: survey datum, conceptual studies, and a draw-last method.",
    signatureElement: { name: "The Retention Datum", description: "A continuous survey coordinate cuts through the hero and anchors the page to an existing place.", justification: "The line is both navigation and argument: begin with measured reality before adding form." },
    referencesSampled: ["Survey annotations", "Material schedules", "Architectural retention maps"],
  },
  critique: { passed: true, flaggedElements: [], positiveElements: ["Evidence-led portfolio structure", "Fictional work labelled honestly", "Single survey datum as signature"], verdict: "Curated public demo: architecture is framed as a retention decision rather than an image gallery.", transcript: "Hand-curated reference. No provider call was used to produce this exact project in this browser session." },
  code: { code: architectureHtml, framework: "html", componentName: "index.html", setupNotes: "Dependency-free public demo. Edit all four files and export the current project as ZIP." },
  archetype: { id: "sage", name: "Sage", secondaryId: "creator", confidence: 0.93, reasoning: "The practice earns authority through investigation and explicit decisions, not prestige imagery.", emotionalJob: "Make reuse feel more intelligent and ambitious than demolition.", archetypeConflict: "Full-bleed renders, monochrome awards grids, and unexplained architect language." },
  distinctivenessReport: {
    score: 93, grade: "S", clichesAvoided: ["No full-bleed building render", "No awards-logo strip", "No generic project mosaic"], clichesDetected: [], signatureElement: "The Retention Datum", critiqueSummary: "The register makes the position legible before the visual work becomes decorative.", revisionCount: 1,
    recommendations: ["Replace fictional studies with verified project evidence before production.", "Replace the demo email with a real practice address."], archetypeId: "sage", archetypeCoherence: 93,
    normanLevels: {
      visceral: { score: 94, grade: "S", rationale: "The blunt scale and blue survey line establish a recognizable first frame.", improvements: [] },
      behavioral: { score: 92, grade: "S", rationale: "Studies, method, and enquiry are visible without hunting.", improvements: [] },
      reflective: { score: 93, grade: "S", rationale: "Draw last is a concise identity thesis the audience can repeat.", improvements: ["Support the thesis with real retention outcomes when available."] },
    }, normanSummary: "Curated demo evidence; Render Gate still verifies the runnable result in the browser.",
  },
  restraintResult: { verdict: "disciplined" as const, boldestElement: "The Retention Datum", reasoning: "One coordinate line carries the spatial concept while typography and sections remain systematic.", suggestion: null, restraintScore: 95 },
  engineeringResult: { compositeScore: 96, grade: "S", passed: true, dimensions: [
    { id: "semantic", name: "Semantic HTML", score: 97, weight: 0.2, flags: [], passed: true }, { id: "accessibility", name: "Accessibility", score: 96, weight: 0.25, flags: [], passed: true }, { id: "responsive", name: "Responsive Design", score: 95, weight: 0.2, flags: [], passed: true }, { id: "performance", name: "Performance", score: 99, weight: 0.15, flags: [], passed: true }, { id: "clean-code", name: "Clean Code", score: 94, weight: 0.2, flags: [], passed: true },
  ], criticalFailures: [], recommendations: ["Connect the enquiry CTA before production."] },
  project: architectureProject,
};

const carbonBrief = "A carbon operations SaaS for manufacturing teams. It must make data traceability and weekly action feel practical, avoid environmental clichés, and clearly label all demo data.";

const carbonHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Ledgerline is a fictional carbon operations product created as a Verve public demo.">
  <title>Ledgerline / Carbon operations</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip" href="#main">Skip to operations</a>
  <header class="nav"><a class="logo" href="#main">LEDGER/<b>LINE</b></a><p>SHIFT 38 / SAMPLE WORKSPACE<br>FICTIONAL MANUFACTURING DATA</p><nav aria-label="Primary navigation"><a href="#ledger">Exceptions</a><a href="#method">Protocol</a></nav><a class="login" href="#ledger" data-verve-primary-action>Inspect the ledger <span aria-hidden="true">↗</span></a></header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><p class="eyebrow">CONTROL ROOM / WEEK 38 / SIMULATED</p>
        <h1 id="hero-title" data-verve-task="primary-object">See the variance.<br><em>Own the next move.</em></h1>
        <p class="intro">Three plant signals. Two need a decision. Follow one reading back to its source, then assign the next action.</p>
        <a class="hero-action" href="#ledger" data-verve-primary-action>Open exception 01 <span aria-hidden="true">↘</span></a>
      </div>
      <div class="hero-data" data-verve-layer="data" data-verve-visual-purpose="Weekly exception trend and current decision load">
        <div class="data-head"><span>SHIFT SIGNAL / 07 DAYS</span><span>SIMULATED DATA</span></div>
        <svg viewBox="0 0 540 168" role="img" aria-labelledby="trend-title trend-desc" preserveAspectRatio="none"><title id="trend-title">Weekly emissions exception trend</title><desc id="trend-desc">A fictional seven-day signal rises above the review threshold twice, then returns toward baseline.</desc><path class="gridline" d="M0 38H540 M0 84H540 M0 130H540"/><path class="threshold" d="M0 84H540"/><path class="trend-fill" d="M0 117 L90 108 L180 80 L270 48 L360 95 L450 63 L540 91 L540 168 L0 168Z"/><path class="trend" d="M0 117 L90 108 L180 80 L270 48 L360 95 L450 63 L540 91"/><circle cx="270" cy="48" r="7"/><circle cx="450" cy="63" r="7"/></svg>
        <div class="data-axis"><span>MON</span><span>WED</span><span>FRI</span><span>SUN</span></div>
        <div class="reading" data-verve-task="decision-evidence"><span><strong>02</strong><small>NEED REVIEW</small></span><span><strong>01</strong><small>TRACE CLOSED</small></span><span><strong>0.82</strong><small>tCO₂e / UNIT*</small></span></div>
        <small class="data-note">*Illustrative intensity. No live plant data or verified emissions claim.</small>
      </div>
    </section>
    <section class="ledger" id="ledger" aria-labelledby="ledger-title">
      <header><div><p>EXCEPTION REGISTER / 03 SAMPLE SITES</p><h2 id="ledger-title">One number.<br><em>A visible trail.</em></h2></div><div class="filters" aria-label="Filter sample ledger"><button type="button" class="active" data-filter="all" aria-pressed="true">All / 03</button><button type="button" data-filter="review" aria-pressed="false">Needs review / 02</button></div></header>
      <div class="ledger-layout"><div class="table-wrap"><table><caption>Fictional operational exceptions. Select a row to inspect its evidence.</caption><thead><tr><th>Plant / signal</th><th>Observed</th><th>Source</th><th>Owner</th><th>Status</th></tr></thead><tbody>
        <tr data-case-row="derby" data-status="review"><td data-label="Plant"><button type="button" data-open-case="derby" aria-controls="case-panel" aria-expanded="true"><small>01 / DERBY</small><strong>Steam variance</strong></button></td><td data-label="Observed">+8.0%</td><td data-label="Source">Meter M-14</td><td data-label="Owner" data-owner-cell>Unassigned</td><td data-label="Status" data-status-cell><b>Review</b></td></tr>
        <tr data-case-row="brno" data-status="closed"><td data-label="Plant"><button type="button" data-open-case="brno" aria-controls="case-panel" aria-expanded="false"><small>02 / BRNO</small><strong>Grid factor update</strong></button></td><td data-label="Observed">−3.2%</td><td data-label="Source">EU factor set</td><td data-label="Owner" data-owner-cell>Data team</td><td data-label="Status" data-status-cell>Closed</td></tr>
        <tr data-case-row="porto" data-status="review"><td data-label="Plant"><button type="button" data-open-case="porto" aria-controls="case-panel" aria-expanded="false"><small>03 / PORTO</small><strong>Freight gap</strong></button></td><td data-label="Observed">2 loads</td><td data-label="Source">Carrier feed</td><td data-label="Owner" data-owner-cell>Unassigned</td><td data-label="Status" data-status-cell><b>Review</b></td></tr>
      </tbody></table></div>
      <aside class="case-panel" id="case-panel" aria-labelledby="case-title" tabindex="-1"><div class="case-top"><span>SELECTED EXCEPTION / <b data-case-number>01</b></span><span class="case-status" data-case-status>NEEDS REVIEW</span></div><h3 id="case-title" data-case-title>Derby / steam variance</h3><p data-case-summary>Steam use rose 8% against the seven-day sample baseline.</p><ol class="trace"><li><span>01 / READING</span><strong data-case-reading>Meter M-14 · 18 Sep, 08:40</strong></li><li><span>02 / SOURCE</span><strong data-case-source>Boiler-line telemetry import</strong></li><li><span>03 / NEXT ACTION</span><strong data-case-action>Confirm calibration before closing the variance.</strong></li></ol><label for="case-owner">Assign follow-up to</label><select id="case-owner" data-case-owner><option value="">Choose a sample team</option><option value="Utilities">Utilities</option><option value="Data team">Data team</option><option value="Logistics">Logistics</option></select><button type="button" class="assign" data-assign>Assign sample action <span aria-hidden="true">↗</span></button><p class="case-feedback" data-case-feedback role="status">Demo-only interaction. Changes stay in this preview session.</p></aside></div>
      <small class="disclaimer">Every site, value, owner, date, and source shown here is fictional. No assignment is sent or stored.</small>
    </section>
    <section class="method" id="method" aria-labelledby="method-title"><p>01 / Capture<br>Source attached</p><p>02 / Resolve<br>Owner assigned</p><p>03 / Prove<br>Change recorded</p><h2 id="method-title">The audit trail<br><em>is the interface.</em></h2></section>
    <section class="cta" aria-labelledby="cta-title"><p>Stop reconciling the same uncertainty twice.</p><h2 id="cta-title">Trace the source.<br>Move the number.</h2><a href="mailto:demo@example.com">Request a walkthrough <span aria-hidden="true">↗</span></a><small>Demo contact · replace before publishing</small></section>
  </main>
  <script src="script.js"></script>
</body>
</html>`;

const carbonCss = `:root{--mist:#dbe5e3;--ink:#101514;--acid:#d7ff3f;--signal:#e54b2f;--steel:#63807b;font-family:Arial,"Segoe UI",sans-serif;color:var(--ink);background:var(--mist)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--mist);color:var(--ink)}a{color:inherit}.skip{position:fixed;z-index:20;top:10px;left:10px;padding:12px 16px;background:#fff;transform:translateY(-160%)}.skip:focus{transform:none}.nav{min-height:84px;display:grid;grid-template-columns:1fr 1fr auto auto;align-items:center;gap:36px;padding:0 clamp(20px,4vw,64px);border-bottom:1px solid rgba(16,21,20,.25)}.logo{text-decoration:none;font-weight:900;letter-spacing:-.04em}.logo b{color:var(--signal)}.nav p{font-size:.65rem;line-height:1.4;text-transform:uppercase;letter-spacing:.1em}.nav nav{display:flex;gap:24px}.nav nav a{font-size:.75rem;text-decoration:none}.login{display:grid;place-items:center;min-height:44px;padding:0 18px;background:var(--ink);color:var(--mist);text-decoration:none;font-size:.75rem}.hero{position:relative;min-height:calc(100vh - 84px);padding:clamp(44px,7vw,96px) clamp(20px,6vw,88px);border-bottom:1px solid rgba(16,21,20,.25)}.eyebrow{margin:0 0 7vh;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase}.hero h1{margin:0;font-size:clamp(4.5rem,11.5vw,10.5rem);line-height:.75;letter-spacing:-.08em}.hero h1 em{font-family:Georgia,serif;font-weight:400;color:var(--signal)}.reading{position:absolute;right:5vw;top:10vh;width:220px;aspect-ratio:1;background:var(--ink);color:var(--mist);padding:22px;display:flex;flex-direction:column}.reading small{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase}.reading strong{margin-top:auto;color:var(--acid);font-size:4.6rem;line-height:.8;letter-spacing:-.08em}.reading span{margin-top:8px;font-size:.75rem}.reading i{margin-top:8px;color:#93a6a2;font-size:.63rem}.intro{width:min(480px,45vw);margin:8vh 0 0 auto;font-family:Georgia,serif;font-size:1.1rem;line-height:1.65}.ledger{padding:clamp(72px,10vw,140px) clamp(20px,6vw,88px);background:var(--ink);color:var(--mist)}.ledger>header{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-bottom:64px}.ledger header p,.method>p,.cta>p{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase}.ledger h2,.method h2,.cta h2{margin:0;font-size:clamp(3.6rem,8vw,8rem);line-height:.82;letter-spacing:-.07em}.filters{display:flex;gap:6px}.filters button{min-height:44px;border:1px solid #52605d;background:transparent;color:var(--mist);padding:0 15px;cursor:pointer}.filters button.active{background:var(--acid);border-color:var(--acid);color:var(--ink)}.table-wrap{overflow-x:auto}table{width:100%;min-width:720px;border-collapse:collapse}caption{text-align:left;padding-bottom:14px;color:#879692;font-size:.68rem}th,td{text-align:left;padding:22px 12px;border-top:1px solid #38413f}th{color:#879692;font-size:.65rem;text-transform:uppercase;letter-spacing:.1em}td{font-size:.85rem}td b{color:var(--acid)}tr[hidden]{display:none}.disclaimer{display:block;margin-top:15px;color:#879692}.method{min-height:88vh;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:auto 1fr;gap:0;padding:0 clamp(20px,6vw,88px);background:var(--acid)}.method>p{margin:0;padding:30px 20px;border-left:1px solid rgba(16,21,20,.25);line-height:1.8}.method>p:nth-child(3){border-right:1px solid rgba(16,21,20,.25)}.method h2{grid-column:1/-1;align-self:center;font-size:clamp(4.1rem,11vw,10rem)}.method h2 em{color:var(--signal);font-family:Georgia,serif;font-weight:400}.cta{min-height:82vh;padding:clamp(72px,10vw,140px) clamp(20px,6vw,88px);background:var(--signal);color:#f2eee4}.cta h2{margin:13vh 0 8vh;font-size:clamp(4rem,10vw,9rem)}.cta>a{display:inline-block;border-bottom:1px solid;padding-bottom:8px;text-decoration:none}.cta small{display:block;margin-top:14px;color:#ffd0c7}@media(max-width:760px){.nav{grid-template-columns:1fr auto}.nav p,.nav nav{display:none}.hero{min-height:800px}.hero h1{font-size:clamp(4rem,20vw,6.8rem)}.reading{top:auto;right:20px;bottom:14vh;width:180px}.intro{position:absolute;left:20px;bottom:5vh;width:55vw;margin:0;font-size:.95rem}.ledger>header{display:grid}.filters{flex-wrap:wrap}.method{grid-template-columns:1fr;grid-template-rows:auto}.method>p{border-left:0;border-bottom:1px solid rgba(16,21,20,.25)}.method>p:nth-child(3){border-right:0}.method h2{grid-column:1;padding:80px 0}.cta h2{font-size:clamp(3.7rem,17vw,6rem)}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}`;

const carbonCssV2 = `${carbonCss.replace("font-size:.62rem", "font-size:.65rem").replace("@media(max-width:760px)", "@media(max-width:900px)")}\n@media(min-width:901px){.hero{min-height:400px;display:grid;grid-template-columns:minmax(260px,.72fr) minmax(340px,1fr) 220px;grid-template-rows:auto 1fr auto;gap:24px 6vw;padding-block:42px}.eyebrow{grid-column:1/-1;margin:0}.hero h1{grid-column:1/3;align-self:center;font-size:clamp(2.9rem,4.4vw,4.7rem);line-height:.82}.hero h1 em{font-family:inherit;font-style:normal;font-weight:900;color:var(--signal)}.reading{position:static;grid-column:3;grid-row:2/4;align-self:stretch;width:auto;aspect-ratio:auto;min-height:220px}.intro{grid-column:1/3;width:min(580px,100%);margin:0;font-family:Arial,"Segoe UI",sans-serif;font-size:1rem}.ledger{padding-block:58px}.ledger>header{align-items:start}.method{min-height:620px}.cta{min-height:620px}}`;

const carbonCssV3 = `${carbonCssV2}
:root{--mist:#dce5e1;--ink:#101b1a;--acid:#dbff43;--signal:#fc7144;font-family:Arial,"Segoe UI",sans-serif}
.nav{min-height:72px;background:var(--ink);color:#e5efea;border-color:#455855;grid-template-columns:1fr 1fr auto auto}.nav p{margin:0;color:#9cb7ae}.logo{font-size:1.05rem}.logo b{color:var(--acid)}.nav nav a{color:#d3e6dd}.login{border:1px solid var(--acid);background:var(--acid);color:var(--ink);font-weight:800}.nav a:focus-visible,.hero a:focus-visible,.ledger button:focus-visible,.ledger select:focus-visible{outline:3px solid var(--signal);outline-offset:3px}
.hero{min-height:440px;display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);grid-template-rows:1fr;align-items:center;gap:clamp(28px,5vw,90px);padding:36px clamp(20px,5vw,78px) 40px;background:var(--ink);color:#ecf3ee;border-bottom:1px solid #4f645e}.hero-copy{min-width:0}.hero .eyebrow{margin:0 0 34px;color:var(--acid);font:700 .67rem/1.4 ui-monospace,Consolas,monospace;letter-spacing:.12em}.hero h1{margin:0;font-size:clamp(3.25rem,5.2vw,5.9rem);line-height:.9;letter-spacing:-.067em;font-weight:800}.hero h1 em{font:inherit;color:var(--acid);font-style:normal}.hero .intro{position:static;width:min(520px,100%);margin:24px 0;color:#abc1b7;font-size:1rem;line-height:1.55}.hero-action{display:inline-flex;justify-content:space-between;gap:48px;min-height:46px;align-items:center;margin-top:18px;padding:0 16px;background:var(--acid);color:var(--ink);font-weight:800;text-decoration:none;font-size:.85rem}
.hero-data{min-width:0;border:1px solid #5d7770;background:#172725;padding:16px 20px 13px;box-shadow:12px 12px 0 #0a1110}.data-head,.data-axis{display:flex;justify-content:space-between;gap:10px;font:700 .63rem/1.3 ui-monospace,Consolas,monospace;letter-spacing:.07em}.data-head{color:#b8cec4}.data-head span:last-child{color:var(--acid)}.hero-data svg{width:100%;height:155px;display:block;margin-top:14px;overflow:visible}.hero-data svg path{fill:none;stroke:#47645d;stroke-width:1}.hero-data svg .threshold{stroke:var(--signal);stroke-dasharray:4 5;opacity:.7}.hero-data svg .trend-fill{fill:#dbff4320;stroke:none}.hero-data svg .trend{stroke:var(--acid);stroke-width:4;stroke-linejoin:round;stroke-linecap:round}.hero-data svg circle{fill:var(--signal);stroke:#172725;stroke-width:3}.data-axis{color:#849f94}.reading{position:static;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;width:auto;height:auto;min-height:0;aspect-ratio:auto;margin-top:17px;padding:0;background:transparent;color:#ecf3ee}.reading>span{display:flex;flex-direction:column;gap:6px;min-width:0;padding:12px 12px 8px;border-top:1px solid #68827a}.reading>span+span{border-left:1px solid #68827a}.reading strong{margin:0;color:var(--acid);font:800 clamp(2rem,3vw,3.2rem)/.95 Arial,sans-serif;letter-spacing:-.06em}.reading small{color:#a5c0b4;font:.62rem/1.4 ui-monospace,Consolas,monospace;letter-spacing:.03em}.data-note{display:block;margin-top:9px;color:#849f94;font-size:.67rem}
.ledger{padding:43px clamp(20px,5vw,78px) 72px;background:var(--mist);color:var(--ink)}.ledger>header{display:flex;align-items:end;gap:20px;margin:0 0 28px}.ledger header p{color:#466159;font-family:ui-monospace,Consolas,monospace}.ledger h2{font-size:clamp(2.2rem,4.2vw,4.2rem);line-height:.91}.ledger h2 em{font-style:normal;color:#aa4327}.filters button{border-color:#8a9e96;color:var(--ink);font-weight:700}.filters button.active{background:var(--ink);border-color:var(--ink);color:var(--acid)}.ledger-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(290px,.85fr);gap:16px;align-items:stretch}.table-wrap{min-width:0;overflow-x:auto}table{width:100%;min-width:560px;table-layout:fixed}caption{padding-bottom:12px;color:#476159}th,td{padding:17px 10px;border-color:#aabcb5;vertical-align:middle}th{color:#4f6860}th:first-child{width:32%}th:nth-child(2){width:15%}th:nth-child(3){width:19%}th:nth-child(4){width:18%}th:nth-child(5){width:16%}td{font-size:.79rem}td b{color:#a33d23}td button{border:0;background:transparent;color:inherit;padding:0;text-align:left;cursor:pointer}td button small,td button strong{display:block}td button small{color:#587166;font:.64rem/1.3 ui-monospace,Consolas,monospace;letter-spacing:.08em}td button strong{margin-top:5px;font-size:.92rem}tr[data-selected="true"]{background:#c4d7cb}tr[data-selected="true"] td:first-child{box-shadow:inset 4px 0 var(--signal)}tr[hidden]{display:none}
.case-panel{min-width:0;padding:22px 24px;background:#172725;color:#e8f0eb}.case-top{display:flex;justify-content:space-between;gap:12px;font:.62rem/1.35 ui-monospace,Consolas,monospace;letter-spacing:.07em;color:#a9c3b6}.case-status{color:var(--acid);text-align:right}.case-panel h3{margin:27px 0 12px;font-size:clamp(1.6rem,2.5vw,2.6rem);line-height:1;letter-spacing:-.055em}.case-panel>p{color:#b9cec3;line-height:1.5}.trace{list-style:none;padding:0;margin:25px 0}.trace li{display:grid;grid-template-columns:105px 1fr;gap:12px;padding:11px 0;border-top:1px solid #52665e}.trace span{color:#98b4a6;font:.6rem/1.4 ui-monospace,Consolas,monospace}.trace strong{font-size:.78rem;line-height:1.35;font-weight:600}.case-panel label{display:block;margin-bottom:8px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.case-panel select{width:100%;min-height:42px;padding:8px;background:#e8f0eb;color:var(--ink);border:0;font:inherit}.assign{display:flex;justify-content:space-between;gap:12px;width:100%;min-height:44px;margin-top:10px;padding:12px 13px;border:0;background:var(--acid);color:var(--ink);font-weight:800;cursor:pointer}.assign:disabled{opacity:.55;cursor:not-allowed}.case-feedback{min-height:36px;margin:12px 0 0!important;color:#a9c3b6!important;font-size:.67rem;line-height:1.45}.disclaimer{color:#4d665d;font-size:.7rem}
@media(max-width:1050px){.hero{grid-template-columns:1fr 1fr}.hero h1{font-size:clamp(2.8rem,5vw,4.2rem)}.ledger-layout{grid-template-columns:1fr}.case-panel{max-width:none}}
@media(max-width:760px){.nav{min-height:66px;grid-template-columns:1fr auto;padding-inline:18px}.nav p,.nav nav{display:none}.login{font-size:.7rem;padding-inline:10px}.hero{min-height:0;display:grid;grid-template-columns:1fr;gap:23px;padding:27px 18px 34px}.hero .eyebrow{margin-bottom:16px}.hero h1{font-size:clamp(2.65rem,11vw,4.8rem)}.hero .intro{margin:18px 0 4px;font-size:.91rem}.hero-action{margin-top:12px}.hero-data{padding:13px 14px;box-shadow:6px 6px 0 #0a1110}.hero-data svg{height:93px;margin-top:8px}.reading{margin-top:8px}.reading>span{padding:8px 5px 2px}.reading strong{font-size:clamp(1.7rem,8vw,2.4rem)}.reading small{font-size:.52rem}.data-note{font-size:.6rem}.ledger{padding:30px 18px 56px}.ledger>header{display:grid;gap:18px}.ledger h2{font-size:clamp(2.25rem,9vw,3.5rem)}.filters{display:flex;flex-wrap:nowrap}.filters button{flex:1;white-space:nowrap;font-size:.7rem;padding:0 8px}.table-wrap{overflow:visible}table,tbody{display:block;min-width:0}thead{display:none}caption{display:block;font-size:.68rem}tr{display:grid;grid-template-columns:1fr 1fr;gap:7px 11px;padding:13px 12px;margin-bottom:9px;border:1px solid #9fb3a9}td{display:block;min-width:0;padding:0;border:0;overflow-wrap:anywhere}td:first-child{grid-column:1/-1}td:before{content:attr(data-label);display:block;color:#536b60;font:.56rem/1.4 ui-monospace,Consolas,monospace;text-transform:uppercase}td:first-child:before{display:none}td button strong{font-size:1rem}tr[data-selected="true"] td:first-child{box-shadow:none}.case-panel{padding:20px 18px}.trace li{grid-template-columns:94px 1fr}.method{min-height:0}.method h2{font-size:clamp(3rem,11vw,5rem)}.cta{min-height:0}.cta h2{font-size:clamp(3rem,11vw,5rem)}}
.data-head,.data-axis,.reading small,.case-top,.trace span,.case-feedback,td:before,.data-note{font-size:11px}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-data *{animation:none!important}}
`;

const carbonScript = `(() => {
  const cases = {
    derby: { number: "01", title: "Derby / steam variance", summary: "Steam use rose 8% against the seven-day sample baseline.", reading: "Meter M-14 · 18 Sep, 08:40", source: "Boiler-line telemetry import", action: "Confirm calibration before closing the variance.", owner: "", status: "review" },
    brno: { number: "02", title: "Brno / grid factor update", summary: "The sample calculation changed when its factor set was refreshed.", reading: "Grid factor · 17 Sep, 11:05", source: "Illustrative EU factor set", action: "Source reviewed. No follow-up in this demo.", owner: "Data team", status: "closed" },
    porto: { number: "03", title: "Porto / freight gap", summary: "Two sample loads have no carrier emissions record yet.", reading: "Dispatch log · 19 Sep, 07:10", source: "Carrier feed import", action: "Request the two missing records from the carrier.", owner: "", status: "review" }
  };
  const rows = [...document.querySelectorAll('[data-case-row]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const panel = document.querySelector('#case-panel');
  const owner = document.querySelector('[data-case-owner]');
  const assign = document.querySelector('[data-assign]');
  const feedback = document.querySelector('[data-case-feedback]');
  let selected = 'derby';
  const setText = (selector, value) => { document.querySelector(selector).textContent = value; };
  function showCase(id, focus = false) {
    selected = id;
    const item = cases[id];
    rows.forEach((row) => {
      const active = row.dataset.caseRow === id;
      row.dataset.selected = String(active);
      row.querySelector('[data-open-case]').setAttribute('aria-expanded', String(active));
    });
    setText('[data-case-number]', item.number);
    setText('[data-case-title]', item.title);
    setText('[data-case-summary]', item.summary);
    setText('[data-case-reading]', item.reading);
    setText('[data-case-source]', item.source);
    setText('[data-case-action]', item.action);
    setText('[data-case-status]', item.status === 'closed' ? 'CLOSED / SAMPLE' : item.owner ? 'FOLLOW-UP ASSIGNED' : 'NEEDS REVIEW');
    owner.value = item.owner;
    owner.disabled = item.status === 'closed';
    assign.disabled = item.status === 'closed';
    feedback.textContent = item.status === 'closed' ? 'Closed sample record. No action is available.' : 'Demo-only interaction. Changes stay in this preview session.';
    if (focus) { panel.focus({ preventScroll: true }); panel.scrollIntoView({ block: 'nearest' }); }
  }
  rows.forEach((row) => row.querySelector('[data-open-case]').addEventListener('click', () => showCase(row.dataset.caseRow, true)));
  filters.forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filters.forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    rows.forEach((row) => { row.hidden = filter === 'review' && row.dataset.status !== 'review'; });
    if (rows.find((row) => row.dataset.caseRow === selected)?.hidden) {
      const firstVisible = rows.find((row) => !row.hidden);
      if (firstVisible) showCase(firstVisible.dataset.caseRow);
    }
  }));
  assign.addEventListener('click', () => {
    if (!owner.value || cases[selected].status === 'closed') { feedback.textContent = 'Choose a sample team before assigning the follow-up.'; owner.focus(); return; }
    cases[selected].owner = owner.value;
    const row = rows.find((entry) => entry.dataset.caseRow === selected);
    row.querySelector('[data-owner-cell]').textContent = owner.value;
    row.querySelector('[data-status-cell]').textContent = 'Assigned';
    setText('[data-case-status]', 'FOLLOW-UP ASSIGNED');
    feedback.textContent = 'Sample follow-up assigned to ' + owner.value + '. Nothing was sent or stored.';
  });
  showCase(selected);
})();`;

const carbonProject: GeneratedProject = {
  schemaVersion: 1, name: "ledgerline-carbon-operations", framework: "html", entryFile: "index.html",
  files: [
    { path: "index.html", content: carbonHtml, language: "html", role: "source" },
    { path: "styles.css", content: carbonCssV3, language: "css", role: "source" },
    { path: "script.js", content: carbonScript, language: "javascript", role: "source" },
    { path: "README.md", content: "# Ledgerline — Verve public demo\n\nA dependency-free, fictional carbon-operations workbench. Inspect an exception, trace its sample source, choose a sample team, and assign a local-only follow-up. No data is sent or stored. Every plant, figure, date and source is fictional. Open `index.html` or serve the folder with a static server.\n", language: "markdown", role: "documentation" },
    { path: "ASSETS.md", content: "# Asset manifest\n\n- Typography: intentional local system sans and monospace stacks; no remote font request.\n- Seven-day trend: original inline SVG drawn from fictional sample values; no third-party visual asset.\n- Status and trace interface: generated in HTML/CSS; Verve-authored.\n- Operational data: all plants, dates, readings and sources are fictional. Assignment is local preview state only.\n", language: "markdown", role: "documentation" },
  ], dependencies: {}, scripts: {}, warnings: [], readiness: { status: "ready", score: 97 }, validation: { status: "ready", score: 97, checks: [], failed: 0, warnings: 0 },
};

const carbonResult = {
  ...PUBLIC_DEMO_RESULT,
  briefAnalysis: { subject: "Carbon operations software for manufacturing", audience: "Plant operators, sustainability leads, and manufacturing CFOs", primaryJob: "Trace emissions exceptions and assign action before reporting closes", tone: "Operational, exact, calm, accountable", industry: "Climate SaaS / Manufacturing" },
  plan: {
    colorPalette: [{ name: "Process Mist", hex: "#DBE5E3", role: "background" }, { name: "Machine Ink", hex: "#101514", role: "text / dark surface" }, { name: "Action Acid", hex: "#D7FF3F", role: "operational state" }, { name: "Exception", hex: "#E54B2F", role: "primary signal" }],
    typePairing: { display: "Arial / system sans", body: "Arial / system sans + system monospace labels", rationale: "Dense operational data uses compact, local sans and monospace stacks without depending on a remote font." },
    layoutConcept: "A shift signal, exception register, and source-trace inspector share one operational surface with a local assignment action.",
    signatureElement: { name: "The Source-Trail Console", description: "Selecting a variance reveals its sample reading, source, next action, and accountable team in one persistent inspector.", justification: "The chart is context, but the source trail and next action carry the real task." },
    referencesSampled: ["Factory shift boards", "Exception ledgers", "Audit-source registers"],
  },
  critique: { passed: true, flaggedElements: [], positiveElements: ["No green-tech cliché", "Sample data labelled repeatedly", "Working source-trail assignment"], verdict: "Curated public demo: operational evidence replaces the familiar climate dashboard aesthetic.", transcript: "Hand-curated public demonstration. No provider call was used in this browser session." },
  code: { code: carbonHtml, framework: "html", componentName: "index.html", setupNotes: "Dependency-free public demo. Inspect a case, test the sample assignment, and export ZIP." },
  archetype: { id: "ruler", name: "Ruler", secondaryId: "sage", confidence: 0.91, reasoning: "The product creates control through traceable sources, owners, and status.", emotionalJob: "Turn carbon reporting uncertainty into a manageable weekly operation.", archetypeConflict: "Leaf icons, green gradients, generic KPI cards, and untraceable impact claims." },
  distinctivenessReport: {
    score: 91, grade: "S", clichesAvoided: ["No leaf iconography", "No green gradient", "No generic four-card dashboard"], clichesDetected: [], signatureElement: "The Emissions Shift Register", critiqueSummary: "The operational ledger makes source and ownership more prominent than vanity KPIs.", revisionCount: 1,
    recommendations: ["Replace illustrative rows with permissioned customer data.", "Connect access controls before production use."], archetypeId: "ruler", archetypeCoherence: 91,
    normanLevels: {
      visceral: { score: 91, grade: "S", rationale: "Acid state color and the oversized reading create a sharp industrial frame.", improvements: [] },
      behavioral: { score: 94, grade: "S", rationale: "The filter demonstrates the source-owner-status interaction directly.", improvements: ["Add keyboard sorting when the ledger becomes a real data grid."] },
      reflective: { score: 90, grade: "S", rationale: "The audit trail is the interface is a clear product thesis.", improvements: ["Add verified customer proof once available."] },
    }, normanSummary: "Curated demo evidence; the browser verifies behavior and structure independently.",
  },
  restraintResult: { verdict: "disciplined" as const, boldestElement: "The Emissions Shift Register", reasoning: "One ledger and one state color carry the product story without a field of decorative widgets.", suggestion: null, restraintScore: 94 },
  engineeringResult: { compositeScore: 96, grade: "S", passed: true, dimensions: [
    { id: "semantic", name: "Semantic HTML", score: 97, weight: 0.2, flags: [], passed: true }, { id: "accessibility", name: "Accessibility", score: 96, weight: 0.25, flags: [], passed: true }, { id: "responsive", name: "Responsive Design", score: 95, weight: 0.2, flags: [], passed: true }, { id: "performance", name: "Performance", score: 99, weight: 0.15, flags: [], passed: true }, { id: "clean-code", name: "Clean Code", score: 94, weight: 0.2, flags: [], passed: true },
  ], criticalFailures: [], recommendations: ["Add real authorization before connecting operational data."] },
  project: carbonProject,
};

const AUTHORED_PUBLIC_DEMOS = [
  {
    id: "architecture", index: "01", category: "Adaptive reuse / London", title: "Reframe", description: "A spatial retention register for an adaptive-reuse practice.", proof: "PHOTO-LED SPATIAL MAP", brief: architectureBrief, result: architectureResult,
    receipt: receipt({ direction: { creativityClass: "exploratory", experienceModel: "spatial-canvas", topology: "survey-field", opening: "spatial-map", navigation: "coordinate-index" }, fingerprint: { occupancy: "vertical-datum/asymmetric-register", colorRhythm: "concrete-blue-oxide", mediaRatio: 0.34, interactionDensity: 0.18 }, abstractReferences: { near: "architectural retention maps", remote: ["geological survey notation", "museum object registers"], antiReference: "full-bleed render portfolio" } }),
  },
  {
    id: "cairo", index: "02", category: "Hospitality / Arabic RTL", title: "Maeda Cairo", description: "An Arabic-first reservation journey shaped like a city receipt.", proof: "RTL DECISION JOURNEY", brief: PUBLIC_DEMO_BRIEF, result: PUBLIC_DEMO_RESULT,
    receipt: receipt({ direction: { creativityClass: "combinational", experienceModel: "guided-journey", topology: "menu-receipt", opening: "service-sun", navigation: "story-to-reservation" }, fingerprint: { occupancy: "rtl-offset/sun-axis", colorRhythm: "papyrus-tomato-pickle", mediaRatio: 0.16, interactionDensity: 0.24 }, abstractReferences: { near: "seasonal menu systems", remote: ["market receipts", "solar service clocks"], antiReference: "luxury restaurant photo hero" } }),
  },
  {
    id: "carbon", index: "03", category: "Climate SaaS / Operations", title: "Ledgerline", description: "A dense exception workbench centered on provenance and action.", proof: "DATA OPERATIONS WORKBENCH", brief: carbonBrief, result: carbonResult,
    receipt: receipt({ direction: { creativityClass: "transformational", experienceModel: "operational-workbench", topology: "exception-ledger", opening: "live-reading", navigation: "filter-and-resolve" }, fingerprint: { occupancy: "signal-grid/source-trail", colorRhythm: "ink-acid-mist-oxide", mediaRatio: 0.04, interactionDensity: 0.57 }, abstractReferences: { near: "factory exception boards", remote: ["air-traffic handoff logs", "financial audit trails"], antiReference: "four-card green SaaS dashboard" } }),
  },
  {
    id: "learning", index: "04", category: "Education / Interactive lab", title: "Orbit Lab", description: "A playful cause-and-effect experiment where the diagram answers the learner.", proof: "INTERACTIVE PLAY CANVAS", brief: "An interactive science lesson for young learners. It must make gravity understandable through experimentation rather than a passive course page.", result: learningResult,
    receipt: receipt({ direction: { creativityClass: "transformational", experienceModel: "play-canvas", topology: "radial-simulator", opening: "manipulable-object", navigation: "lesson-rail" }, fingerprint: { occupancy: "radial-center/side-console", colorRhythm: "night-cyan-pink-yellow", mediaRatio: 0.46, interactionDensity: 0.64 }, abstractReferences: { near: "hands-on science exhibits", remote: ["music synthesizer controls", "planetarium path traces"], antiReference: "course-card landing page" } }),
  },
  {
    id: "fashion", index: "05", category: "Fashion / Collection browser", title: "Fold No. 7", description: "A reversible, nonlinear rail for exploring silhouette and construction.", proof: "NONLINEAR VISUAL BROWSER", brief: "A trans-seasonal fashion collection. The experience should privilege silhouette, material, and self-directed browsing without copying luxury campaign conventions.", result: fashionResult,
    receipt: receipt({ direction: { creativityClass: "exploratory", experienceModel: "collection-browser", topology: "horizontal-rail", opening: "first-look", navigation: "rail-or-index" }, fingerprint: { occupancy: "full-height-panels/horizontal", colorRhythm: "vermilion-silver-cobalt", mediaRatio: 0.73, interactionDensity: 0.31 }, abstractReferences: { near: "lookbook sequencing", remote: ["film contact sheets", "reversible garment construction"], antiReference: "centered luxury campaign hero" } }),
  },
  {
    id: "civic", index: "06", category: "Civic service / Guided flow", title: "Clearpath", description: "A calm three-state route from uncertainty to a prepared next step.", proof: "ACCESSIBLE GUIDED FLOW", brief: "A public-facing employment guidance service. It must reduce anxiety, use plain language, protect privacy, and avoid implying legal outcomes.", result: civicResult,
    receipt: receipt({ direction: { creativityClass: "combinational", experienceModel: "guided-service", topology: "state-machine", opening: "single-question", navigation: "persistent-route-rail" }, fingerprint: { occupancy: "left-route/focused-step", colorRhythm: "navy-paper-blue-mint", mediaRatio: 0.02, interactionDensity: 0.52 }, abstractReferences: { near: "civic eligibility interviews", remote: ["airport wayfinding", "medical intake checklists"], antiReference: "legal practice-area grid" } }),
  },
] as const;

export type PublicDemoId = (typeof AUTHORED_PUBLIC_DEMOS)[number]["id"];
type PublicDemo = Omit<(typeof AUTHORED_PUBLIC_DEMOS)[number], "receipt"> & { receipt: PublicDemoReceipt; meetsMeasuredDiversityFloor: boolean };

/** Manual story language is preserved, but every numeric distance now comes from the browser evidence baseline. */
export const PUBLIC_DEMOS: PublicDemo[] = AUTHORED_PUBLIC_DEMOS.map((demo) => {
  const measurement = measuredVisualTruth.examples[demo.id];
  return {
    ...demo,
    meetsMeasuredDiversityFloor: measurement.nearestMeasuredExampleDistance >= PUBLIC_DEMO_DIVERSITY_THRESHOLD,
    receipt: {
      ...demo.receipt,
      nearestExampleDistance: measurement.nearestMeasuredExampleDistance,
      measurement,
    },
  };
});

export const DEFAULT_PUBLIC_DEMO_ID: PublicDemoId = "architecture";
