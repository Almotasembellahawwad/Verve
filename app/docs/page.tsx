/* eslint-disable react/no-unescaped-entities, react/jsx-no-comment-textnodes, @typescript-eslint/no-unused-vars */
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Docs — Verve Developer Reference",
  description:
    "Complete developer reference for Verve: API documentation, engine architecture, pipeline modules, and contributing guide.",
};

const TABS = [
  { id: "architecture", label: "Architecture" },
  { id: "api",          label: "API Reference" },
  { id: "engine",       label: "Engine" },
  { id: "contributing", label: "Contributing" },
] as const;

export default function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return <DocsContent />;
}

function DocsContent() {
  return (
    <div className={styles.root}>
      {/* Sidebar nav */}
      <nav className={styles.sidebar} aria-label="Documentation navigation">
        <Link href="/" className={styles.backLink}>
          ← Back to Verve
        </Link>
        <div className={styles.sidebarTitle}>Developer Reference</div>
        <ul className={styles.sidebarNav}>
          {TABS.map((tab) => (
            <li key={tab.id}>
              <a href={`#${tab.id}`} className={styles.sidebarLink}>
                {tab.label}
              </a>
            </li>
          ))}
          <li className={styles.sidebarDivider} />
          <li>
            <Link href="/lab" className={styles.sidebarLink}>
              Advanced lab →
            </Link>
          </li>
          <li>
            <a href="https://github.com/Almotasembellahawwad/Verve" target="_blank" rel="noopener noreferrer" className={styles.sidebarLink}>
              GitHub ↗
            </a>
          </li>
          <li>
            <a href="/api/cliches" target="_blank" rel="noopener noreferrer" className={styles.sidebarLink}>
              GET /api/cliches ↗
            </a>
          </li>
          <li>
            <a href="/api/library" target="_blank" rel="noopener noreferrer" className={styles.sidebarLink}>
              GET /api/library ↗
            </a>
          </li>
        </ul>
      </nav>

      {/* Main content */}
      <main className={styles.content}>
        <div className={styles.pageHeader}>
          <span className={styles.pageTag}>// docs</span>
          <h1 className={styles.pageTitle}>Developer Reference</h1>
          <p className={styles.pageSubtitle}>
            Everything you need to understand, extend, and contribute to Verve.
          </p>
        </div>

        {/* ── Architecture ─────────────────────────────────────── */}
        <section id="architecture" className={styles.section}>
          <h2 className={styles.sectionTitle}>Architecture</h2>
          <p className={styles.sectionLead}>
            Think of the pipeline as four phases: Understand, Direct, Build, and Prove. The numbered modules make failures inspectable; they are not separate agents. Fast mode uses two core model calls and local preflight rules, while Studio adds adversarial critique and bounded repair. Both modes return the same runnable project contract.
          </p>
          <p className={styles.sectionLead}>
            Delivery continues in the local-first <Link href="/editor">project editor</Link>: complete projects autosave to IndexedDB, keep bounded revisions, and re-run deterministic validation as source changes. HTML and React preview live; full Next.js remains an honest inspect, edit, and export boundary.
          </p>

          <div className={styles.pipeline}>
            {[
              { id: "01", name: "Brief Analyzer",       file: "brief-analyzer.ts",   desc: "Extracts subject, audience, primary job, tone, industry, and hard constraints from the brief. Forces specificity before any design decision is made." },
              { id: "02", name: "Context + Media Gate",  file: "media requirement + assets + blocklist + competitive", desc: "Classifies whether imagery is required, recommended, optional, or avoidable; then sources approved assets, scans 21 cliché families with 67 concrete signals, and maps dominant industry patterns in parallel." },
              { id: "02.5", name: "Brand Archetype",     file: "brand-archetype-resolver.ts", desc: "Resolves the emotional job, primary archetype, and explicit design prohibitions." },
              { id: "02.6", name: "Motion Language",     file: "animation-language.ts", desc: "Derives duration and easing tokens from the chosen archetype, including reduced-motion behavior." },
              { id: "03", name: "Plan + Critique",       file: "plan-generator.ts + critique-loop.ts",  desc: "Builds the design thesis and one signature element, then rejects and revises plans that remain generic." },
              { id: "04", name: "Contrast Enforcement", file: "contrast-fixer.ts",   desc: "Checks intended text/background pairs and applies one stable WCAG AA correction per text token." },
              { id: "04.1", name: "Direction Selection", file: "direction-portfolio.ts + structural-fingerprint.ts", desc: "Assesses three directions against fit, feasibility, structural distance, the retired Verve house style, and browser-local delivered-project memory; then enforces the strongest direction without adding a provider call." },
              { id: "04.2", name: "Experience Contract", file: "project-spec-builder.ts", desc: "Compiles the enforced direction with intent, facts, sections, components, interactions, responsive behavior, media policy, and brand invariants into a bounded VerveProjectSpec before code exists." },
              { id: "05", name: "Code Generation",       file: "code-generator.ts",  desc: "Generates full component code — responsive, accessible, prefers-reduced-motion aware. Output only produced after plan passes critique. Supports Next.js, React, and HTML+CSS." },
              { id: "05.5", name: "Syntax + Repair",     file: "code-quality-loop.ts", desc: "Parses TSX with TypeScript, verifies structure and the signature element, and performs one bounded repair pass." },
              { id: "06", name: "Proof Gates",           file: "scorer + diversity + engineering", desc: "Scores the delivered code, detects Verve's own repeated house template, and keeps visual distinctiveness separate from engineering and production readiness." },
              { id: "07", name: "Project Assembly",       file: "project-builder.ts", desc: "Creates the complete Next.js, React/Vite, or HTML project: source, runtime entry, package manifest, TypeScript configuration, gitignore, and project-specific README." },
            ].map((step, i, arr) => (
              <div key={step.id} className={styles.pipelineStep}>
                <div className={styles.pipelineLeft}>
                  <div className={styles.pipelineId}>{step.id}</div>
                  {i < arr.length - 1 && <div className={styles.pipelineConnector} />}
                </div>
                <div className={styles.pipelineBody}>
                  <div className={styles.pipelineHeader}>
                    <span className={styles.pipelineName}>{step.name}</span>
                    <code className={styles.pipelineFile}>{step.file}</code>
                  </div>
                  <p className={styles.pipelineDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.codeBlock}>
            <div className={styles.codeBlockHeader}>
              <span>run-generation-use-case.ts — application boundary</span>
            </div>
            <pre className={styles.code}>{`// Simplified — transport and provider details are injected at the edge.
export async function runGenerationUseCase(input, dependencies) {
  const strategy = createGenerationStrategy(input.mode);
  const brief = await strategy.analyzeBrief(input, dependencies);
  const context = await buildDeterministicContext(brief, dependencies);
  const direction = await strategy.direct(brief, context, dependencies);
  const generated = await strategy.build(brief, direction, dependencies);
  const project = buildGeneratedProject(generated, brief, direction.plan);
  return proveAndSerialize(project, direction, context);
}`}</pre>
          </div>
        </section>

        {/* ── API Reference ─────────────────────────────────────── */}
        <section id="api" className={styles.section}>
          <h2 className={styles.sectionTitle}>API Reference</h2>
          <p className={styles.sectionLead}>
            Endpoints use BYOK without accounts. The selected provider key is passed in the request body, used for that request, and never stored server-side.
          </p>

          {[
            {
              method: "POST", path: "/api/generate",
              desc: "Run Fast or Studio generation. Returns the plan, validated entry code, complete project files, warnings, contrast report, and both scoring axes.",
              request: `{
  "brief": "A landing page for a carbon accounting SaaS targeting manufacturing CFOs.",
  "existingCode": "<optional — HTML/JSX/CSS to redesign>",
  "framework": "nextjs",  // "nextjs" | "react" | "html"
  "mode": "fast",         // "fast" | "studio"
  "apiKey": "sk-ant-api03-..."
}`,
              response: `{
  "briefAnalysis": {
    "subject": "Carbon accounting dashboard for industrial finance",
    "audience": "Manufacturing CFOs, 45-60, data-driven, skeptical of greenwashing",
    "primaryJob": "Establish credibility through precision and density, not color",
    "tone": "precise, institutional, data-dense, austere",
    "industry": "Climate tech / B2B SaaS"
  },
  "plan": {
    "colorPalette": [
      { "name": "Void", "hex": "#0F0E0D", "role": "primary surface" },
      { "name": "Copper Oxide", "hex": "#7C6E5A", "role": "secondary accent" }
    ],
    "typePairing": { "display": "Neue Haas Grotesk", "body": "DM Mono", "rationale": "..." },
    "layoutConcept": "...",
    "signatureElement": { "name": "Audit Trail Striping", "description": "...", "justification": "..." }
  },
  "critique": { "passed": true, "flaggedElements": [], "verdict": "..." },
  "code": { "code": "...", "framework": "nextjs", "componentName": "CarbonDashboard", "setupNotes": "..." },
  "project": {
    "name": "carbon-accounting-dashboard",
    "framework": "nextjs",
    "entryFile": "app/page.tsx",
    "files": [{ "path": "app/page.tsx", "content": "...", "language": "tsx", "role": "source" }],
    "dependencies": { "next": "^16.3.1", "react": "^19.2.4" },
    "warnings": []
  },
  "distinctivenessReport": { "score": 84, "grade": "A", "clichesAvoided": [], "recommendations": [] },
  "revisionCount": 0,
  "durationMs": 14200
}`,
            },
            {
              method: "POST", path: "/api/generate/stream",
              desc: "SSE generation endpoint used by the workbench. Emits stage progress, retries, accurate stage/total heartbeats, optional-stage fallback telemetry, a final result, or a recovery project when a provider stops.",
              request: `Same JSON body as POST /api/generate. Prefer mode: "fast" for free OpenRouter models.`,
              response: `event: connected
event: stage_start
event: heartbeat       // { stageElapsedMs, totalElapsedMs }
event: stage_retry
event: stage_degraded  // optional Studio review used local fallback
event: stage_done
event: result

// Provider failure terminal path:
event: stage_error
event: recovery`,
            },
            {
              method: "POST", path: "/api/critique",
              desc: "Standalone design critic. Analyzes a URL or code for hierarchy, contrast, spacing, typography, and known AI-design clichés. Does not run the full generation pipeline.",
              request: `{
  "code": "<paste component HTML/JSX/CSS>",
  // OR
  "url": "https://yoursite.com",
  "apiKey": "sk-ant-api03-..."
}`,
              response: `{
  "critique": {
    "hierarchyIssues": [{ "issue": "...", "severity": "high", "fix": "..." }],
    "contrastIssues": [],
    "spacingIssues": [{ "issue": "...", "severity": "medium", "fix": "..." }],
    "typographyIssues": [],
    "clicheMatches": [{ "pattern": "Inter 700 hero", "evidence": "...", "fix": "..." }],
    "signatureOpportunities": ["..."],
    "overallScore": 62,
    "summary": "..."
  }
}`,
            },
            {
              method: "GET", path: "/api/cliches",
              desc: "Returns the full public blocklist. Cached for 1 hour. No API key required.",
              response: `{
  "count": 20,
  "version": "2026-08-03",
  "cliches": [
    {
      "id": "color-001",
      "category": "color",
      "pattern": "Blue-to-purple hero gradient",
      "description": "Linear or radial gradient from #6366F1 → #8B5CF6 or similar indigo-violet range...",
      "example_values": ["#6366F1", "#8B5CF6", "from-indigo-500 to-purple-600"],
      "severity": "high",
      "date_observed": "2024-01-15",
      "tags": ["hero", "saas", "landing-page"]
    }
  ]
}`,
            },
            {
              method: "POST", path: "/api/cliches/suggest",
              desc: "Submit a new cliché pattern for community review. Goes to server logs + manual PR queue.",
              request: `{
  "pattern": "Glassmorphism card with backdrop-filter blur",
  "description": "Semi-transparent card with backdrop-filter: blur(20px) and white/10 border...",
  "category": "layout",
  "example_values": ["backdrop-filter: blur(20px)", "bg-white/10", "border-white/20"],
  "severity": "medium"
}`,
            },
            {
              method: "GET", path: "/api/library",
              desc: "Returns the reference library used by the plan generator. 30 curated, annotated design references. Cached for 1 hour.",
            },
          ].map((endpoint) => (
            <div key={endpoint.path} className={styles.endpoint}>
              <div className={styles.endpointHeader}>
                <span className={`${styles.method} ${styles[`method-${endpoint.method.toLowerCase()}`]}`}>
                  {endpoint.method}
                </span>
                <code className={styles.path}>{endpoint.path}</code>
              </div>
              <p className={styles.endpointDesc}>{endpoint.desc}</p>
              {endpoint.request && (
                <div className={styles.codeBlock}>
                  <div className={styles.codeBlockHeader}><span>Request body</span></div>
                  <pre className={styles.code}>{endpoint.request}</pre>
                </div>
              )}
              {endpoint.response && (
                <div className={styles.codeBlock}>
                  <div className={styles.codeBlockHeader}><span>Response</span></div>
                  <pre className={styles.code}>{endpoint.response}</pre>
                </div>
              )}
            </div>
          ))}

          <div className={styles.curlExample}>
            <div className={styles.codeBlockHeader}><span>curl example</span></div>
            <pre className={styles.code}>{`curl -X POST https://your-deployment.vercel.app/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "brief": "A fintech dashboard for retail investors tracking options positions",
    "framework": "react",
    "apiKey": "sk-ant-api03-..."
  }'`}</pre>
          </div>
        </section>

        {/* ── Engine ─────────────────────────────────────────────── */}
        <section id="engine" className={styles.section}>
          <h2 className={styles.sectionTitle}>Engine</h2>
          <p className={styles.sectionLead}>
            Engine modules are bounded services: some wrap one provider call, while specification, diversity, validation, scoring, and project assembly remain deterministic. The application layer composes them as inspectable stages with immutable context patches.
          </p>

          {[
            {
              file: "brief-analyzer.ts",
              exports: "analyzeBrief(brief, existingCode?): Promise<BriefAnalysis>",
              desc: "Extracts structured information from the design brief. Temperature: 0.3 (low, for consistency). Returns: subject, audience, primaryJob, tone, industry, constraints.",
            },
            {
              file: "blocklist-filter.ts",
              exports: "runBlocklistFilter(brief, existingCode?): BlocklistResult",
              desc: "Pure function — no LLM call. Scans inputs against cliches.json using string matching. Returns matched patterns and a systemPromptInjection string that is prepended to all downstream prompts.",
            },
            {
              file: "plan-generator.ts",
              exports: "generateDesignPlan(analysis, blocklistInjection, previousCritique?): Promise<DesignPlan>",
              desc: "Explores exactly three structurally different directions. Verve independently scores and may override the provider's selection, while delivered DOM/CSS traits and recent local fingerprints discourage renamed versions of the same composition without retaining private briefs.",
            },
            {
              file: "critique-loop.ts",
              exports: "runSelfCritique(plan, analysis): Promise<CritiqueResult>",
              desc: "Adversarial self-critique using a separate LLM call with a different system prompt. Returns passed (boolean), flaggedElements, positiveElements, overallVerdict, and rawCritique transcript.",
            },
            {
              file: "code-generator.ts",
              exports: "generateCode(analysis, plan, blocklistInjection, framework): Promise<GeneratedCode>",
              desc: "Generates full component code in the target framework from both the selected design plan and the executable VerveProjectSpec. Returns code string, framework, componentName, and setupNotes.",
            },
            {
              file: "scorer.ts",
              exports: "generateDistinctivenessReport(blocklistResult, plan, critique, revisionCount): DistinctivenessReport",
              desc: "Pure function — no LLM call. Weighs visceral evidence at 50%, behavioral quality at 20%, and reflective meaning at 30%. Critique, blocklist, and usability failures apply hard ceilings so missing review evidence cannot become an S grade.",
            },
            {
              file: "design-critic.ts",
              exports: "critiqueDesign(input: {url?, code?, screenshot?}): Promise<DesignCritique>",
              desc: "Module E — standalone critic used by /api/critique. Accepts URL, code, or screenshot description. Returns hierarchy, contrast, spacing, typography issues plus cliché matches and signature opportunities.",
            },
          ].map((mod) => (
            <div key={mod.file} className={styles.moduleCard}>
              <code className={styles.moduleFile}>{mod.file}</code>
              <code className={styles.moduleExport}>{mod.exports}</code>
              <p className={styles.moduleDesc}>{mod.desc}</p>
            </div>
          ))}

          <div className={styles.callout}>
            <strong>Swapping the LLM provider:</strong> All modules call <code>getLLMAdapter()</code> from <code>lib/llm-adapter/index.ts</code>. To use GPT-4 or Gemini, implement the <code>LLMAdapter</code> interface and replace the singleton factory. No module-level changes required.
          </div>
        </section>

        {/* ── Contributing ──────────────────────────────────────── */}
        <section id="contributing" className={styles.section}>
          <h2 className={styles.sectionTitle}>Contributing</h2>

          <div className={styles.contribBlock}>
            <h3 className={styles.contribTitle}>Adding a cliché pattern</h3>
            <p className={styles.contribDesc}>
              The blocklist in <code>data/cliches.json</code> is the most leverageable part of Verve. Each new entry tightens what the pipeline can produce. Open a PR titled <code>cliche: [pattern name]</code>.
            </p>
            <div className={styles.codeBlock}>
              <div className={styles.codeBlockHeader}><span>data/cliches.json entry template</span></div>
              <pre className={styles.code}>{`{
  "id": "category-NNN",
  "category": "color | typography | layout | motion | copy",
  "pattern": "Short, specific name for the pattern",
  "description": "What it is, why it appears, why it's a regression-to-mean tell",
  "example_values": ["specific hex codes, class names, copy strings, or timing values"],
  "severity": "high | medium | low",
  "date_observed": "YYYY-MM-DD",
  "tags": ["keyword1", "keyword2"]
}`}</pre>
            </div>
            <div className={styles.contribNote}>
              <strong>Good entry:</strong> <code>"#6366F1 / #8B5CF6 gradient — appears in ~60% of AI-generated SaaS hero sections"</code><br />
              <strong>Not useful:</strong> <code>"Don't use blue"</code> — too vague, no example values, unactionable
            </div>
          </div>

          <div className={styles.contribBlock}>
            <h3 className={styles.contribTitle}>Adding a reference entry</h3>
            <p className={styles.contribDesc}>
              The reference library in <code>data/reference-library.json</code> grounds the plan generator in real, high-quality design work. Open a PR titled <code>reference: [name]</code>.
            </p>
            <div className={styles.codeBlock}>
              <div className={styles.codeBlockHeader}><span>data/reference-library.json entry template</span></div>
              <pre className={styles.code}>{`{
  "id": "ref-NNN",
  "name": "Company / Project Name",
  "url": "https://example.com",
  "industry": "fintech | developer-tools | portfolio | ...",
  "mood": ["specific adjective 1", "specific adjective 2"],
  "what_makes_it_work": "The specific named technique that makes this design distinctive. Not 'looks nice.'",
  "specific_techniques": ["named technique 1", "named technique 2"],
  "color_palette": ["#HEX1", "#HEX2", "#HEX3"],
  "tags": ["keyword1", "keyword2"]
}`}</pre>
            </div>
          </div>

          <div className={styles.contribBlock}>
            <h3 className={styles.contribTitle}>UI component guidelines</h3>
            <p className={styles.contribDesc}>
              Components in <code>/components</code> are subject to the same blocklist rules as any Verve output. Run your additions against <code>data/cliches.json</code> before submitting.
            </p>
            <ul className={styles.contribList}>
              <li>No Inter as primary sans-serif — Verve uses Space Grotesk + IBM Plex Mono</li>
              <li>No soft-shadow white cards — use border + depth variation instead</li>
              <li>No blue-to-purple gradients — Vermilion (#F05236) is the only brand accent</li>
              <li>Every interactive element must have a unique, descriptive <code>id</code></li>
              <li>All animations must respect <code>prefers-reduced-motion</code></li>
            </ul>
          </div>

          <a
            href="https://github.com/Almotasembellahawwad/Verve"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubCta}
          >
            View on GitHub → Almotasembellahawwad/Verve
          </a>
        </section>
      </main>
    </div>
  );
}
