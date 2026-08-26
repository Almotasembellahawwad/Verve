"use client";
// app/lab/LabClient.tsx
// Prompt Engineering Lab — client component
import Link from "next/link";

import { useState } from "react";
import { ARCHETYPES, type ArchetypeId } from "@/lib/engine/brand-archetype-resolver";
import styles from "./lab.module.css";

const PIPELINE_MODULES = [
  {
    id: "01",
    name: "Brief Analyzer",
    description: "Extracts subject, audience, primaryJob, tone, industry, and constraints from the raw brief text.",
    systemPromptHighlight: "Analyze the brief and return: subject, audience (specific, not generic), primaryJob (functional job-to-be-done), tone (precise adjectives), industry (single category), constraints[]",
    inputs: ["brief text", "existingCode (optional)"],
    outputs: ["BriefAnalysis"],
  },
  {
    id: "02",
    name: "Asset Sourcing (Module H)",
    description: "Sources optional Pexels images, contextual Lucide icon names, and a platform-safe font stack without a mandatory runtime font request.",
    systemPromptHighlight: "BLOCKED images: handshake, business meeting, generic team, stock smile... Use subject-specific photography when Pexels is available; keep typography runnable without a remote font dependency.",
    inputs: ["BriefAnalysis", "pexelsKey"],
    outputs: ["AssetBundle (photos, fonts, icons)"],
  },
  {
    id: "02L",
    name: "Competitive Field (Module L)",
    description: "Identifies the 5 dominant visual patterns in the brief's industry from a curated dataset of 21 industries.",
    systemPromptHighlight: "No external API. Uses curated competitive intelligence: 21 industries × 5 patterns each, with named brands, root causes, and alternative signals.",
    inputs: ["BriefAnalysis.industry"],
    outputs: ["CompetitiveAnalysis (patterns[], systemPromptInjection)"],
  },
  {
    id: "02.5",
    name: "Brand Archetype (Module I)",
    description: "Identifies the primary and secondary Jungian brand archetype. Results are injected as hard constraints into the plan generator.",
    systemPromptHighlight: "Key distinctions: ruler vs hero (authority vs achievement), creator vs magician (craft vs transformation), sage vs ruler (knowledge vs power), lover vs caregiver (desire vs protection).",
    inputs: ["BriefAnalysis"],
    outputs: ["ArchetypeResolution (primaryArchetype, secondaryArchetype, emotionalJob, archetypeConflict)"],
  },
  {
    id: "02.6",
    name: "Animation Language (Module K)",
    description: "Derives animation tokens from the archetype: easing curves, duration scales, @keyframes, CSS custom properties.",
    systemPromptHighlight: "Synchronous — no LLM call. Purely deterministic from archetype lookup. Outputs CSS tokens injected into both plan generator and code generator.",
    inputs: ["ArchetypeResolution"],
    outputs: ["AnimationLanguage (cssTokens, keyframes, codeGenHint)"],
  },
  {
    id: "03",
    name: "Plan Generator + Cognitive (Module G)",
    description: "Generates colorPalette, typePairing, layoutConcept, signatureElement. Module G enforces 5 cognitive principles.",
    systemPromptHighlight: "5 cognitive layers: Von Restorff (visual isolation), Gutenberg (POA/TA), Signal-Noise (0.0-1.0), Peak-End (closing section), Aesthetic-Usability (contrast baseline). Archetype + animation constraints injected.",
    inputs: ["BriefAnalysis", "Blocklist injection", "Archetype context", "Animation context", "Competitive field injection", "Previous critique"],
    outputs: ["DesignPlan (colorPalette, typePairing, layoutConcept, signatureElement, cognitiveGrounding)"],
  },
  {
    id: "04",
    name: "Critique Loop",
    description: "3-part parallel adversarial critique. Checks: DesignCritic (generic defaults), EndingCheck (Peak-End), UsabilityFloor (contrast, touch targets, body text).",
    systemPromptHighlight: "Revisions: max 2. Triggers when: high-severity generic elements detected OR usabilityFloor.passed = false OR endingCheck.quality = 'filler'",
    inputs: ["DesignPlan", "BriefAnalysis"],
    outputs: ["CritiqueResult (flaggedElements, passed, endingCheck, usabilityFloor, cognitiveScore)"],
  },
  {
    id: "05",
    name: "Code Generator",
    description: "Generates production-ready HTML/CSS (or Next.js component). Receives animation language context for archetype-appropriate motion.",
    systemPromptHighlight: "Framework: nextjs | react | html. Animation tokens injected as CSS custom properties. Code must implement the signature element exactly as specified in the plan.",
    inputs: ["DesignPlan", "BriefAnalysis", "AnimationLanguage context", "Blocklist injection"],
    outputs: ["GeneratedCode (code, framework, componentName, setupNotes)"],
  },
  {
    id: "06",
    name: "Scorer — Norman 3-Level (Module J)",
    description: "Splits the evidence into 3 Norman levels: Visceral (50%), Behavioral (20%), Reflective (30%). Behavioral failures cap the result; usability cannot inflate generic visuals.",
    systemPromptHighlight: "KEY: Behavioral is evaluated BLIND to aesthetics to counter Aesthetic-Usability Effect. Reflective uses archetypeCoherence and Peak-End quality.",
    inputs: ["BlocklistResult", "DesignPlan", "CritiqueResult", "ArchetypeResolution"],
    outputs: ["DistinctivenessReport (normanLevels, archetypeCoherence, normanSummary)"],
  },
];

const SAMPLE_BRIEFS = [
  { label: "Interior Design (Abu Dhabi)", brief: "Interior design company based in Abu Dhabi specializing in high-end residential and hospitality projects. Target clients are HNW individuals and hotel developers. Need to convert site visits to consultation bookings." },
  { label: "Motion Designer Portfolio", brief: "Portfolio site for a senior motion designer at a major studio. Work includes title sequences and brand films. Wants to feel different from typical creative portfolios." },
  { label: "SaaS Analytics Tool", brief: "B2B analytics platform for e-commerce teams. Helps merchandisers understand product performance without SQL. Target: non-technical team leads at $10M-$100M revenue brands." },
  { label: "Luxury Skincare Brand", brief: "Skincare brand launching in the UK market. Ingredients sourced from Norway. Clinical efficacy proven, but brand voice should be warm and accessible. Not cold or pharmaceutical." },
  { label: "Architecture Firm", brief: "Architecture practice in London specializing in adaptive reuse — converting industrial buildings into residential and cultural spaces. Portfolio of 40 completed projects." },
  { label: "Law Firm (Employment)", brief: "Employment law firm focusing on discrimination cases and unfair dismissal. Clients are individuals, not corporations. Needs to feel trustworthy, warm, and on the client's side." },
  { label: "Food Brand (DTC)", brief: "Direct-to-consumer specialty coffee brand. Single-origin beans from Colombia. Founded by a Q-grader. Competing against Blue Bottle, Onyx, Intelligentsia in the specialty segment." },
  { label: "EdTech (Skills)", brief: "Online learning platform teaching data skills to mid-career professionals. 6-week cohort model with live sessions. Outcomes: 80% of graduates get promoted or change roles within 12 months." },
];

export default function LabClient() {
  const [activeModule, setActiveModule] = useState("03");
  const [activeArchetype, setActiveArchetype] = useState<ArchetypeId>("ruler");
  const [copiedBrief, setCopiedBrief] = useState<string | null>(null);

  const activeModuleData = PIPELINE_MODULES.find((m) => m.id === activeModule);
  const archetype = ARCHETYPES[activeArchetype];

  const copyBrief = (brief: string, label: string) => {
    navigator.clipboard.writeText(brief);
    setCopiedBrief(label);
    setTimeout(() => setCopiedBrief(null), 2000);
  };

  const runBrief = (brief: string) => {
    const params = new URLSearchParams({ brief });
    window.open(`/?${params.toString()}#workspace`, "_blank");
  };

  return (
    <div className={styles.lab}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.backLink}>← Workspace</Link>
          <div>
            <h1 className={styles.title}>Prompt Engineering Lab</h1>
            <p className={styles.subtitle}>Pipeline internals · Module reference · Sample briefs · Live run</p>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.metaBadge}>9 modules</span>
          <span className={styles.metaBadge}>12 archetypes</span>
          <span className={styles.metaBadge}>21 industry datasets</span>
        </div>
      </header>

      <div className={styles.body}>
        {/* Pipeline Module Explorer */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pipeline Modules</h2>
          <div className={styles.moduleLayout}>
            {/* Module list */}
            <nav className={styles.moduleNav} aria-label="Pipeline modules">
              {PIPELINE_MODULES.map((m) => (
                <button
                  key={m.id}
                  className={`${styles.moduleBtn} ${activeModule === m.id ? styles.active : ""}`}
                  onClick={() => setActiveModule(m.id)}
                >
                  <span className={styles.moduleId}>[{m.id}]</span>
                  <span className={styles.moduleName}>{m.name}</span>
                </button>
              ))}
            </nav>

            {/* Module detail */}
            {activeModuleData && (
              <div className={styles.moduleDetail}>
                <div className={styles.detailHeader}>
                  <span className={styles.detailId}>[{activeModuleData.id}]</span>
                  <h3 className={styles.detailName}>{activeModuleData.name}</h3>
                </div>
                <p className={styles.detailDesc}>{activeModuleData.description}</p>

                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>System Prompt (key excerpt)</div>
                  <pre className={styles.promptBox}>{activeModuleData.systemPromptHighlight}</pre>
                </div>

                <div className={styles.ioGrid}>
                  <div>
                    <div className={styles.detailLabel}>Inputs</div>
                    <ul className={styles.ioList}>
                      {activeModuleData.inputs.map((inp) => (
                        <li key={inp} className={styles.ioItem}>{inp}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Outputs</div>
                    <ul className={styles.ioList}>
                      {activeModuleData.outputs.map((out) => (
                        <li key={out} className={styles.ioItemOut}>{out}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Archetype Explorer */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Brand Archetype Reference — Module I</h2>
          <div className={styles.archetypeLayout}>
            {/* Archetype picker */}
            <div className={styles.archetypePicker}>
              {(Object.keys(ARCHETYPES) as ArchetypeId[]).map((id) => (
                <button
                  key={id}
                  className={`${styles.archetypeBtn} ${activeArchetype === id ? styles.archetypeActive : ""}`}
                  onClick={() => setActiveArchetype(id)}
                >
                  {ARCHETYPES[id].name}
                </button>
              ))}
            </div>

            {/* Archetype detail */}
            <div className={styles.archetypeDetail}>
              <h3 className={styles.archetypeName}>{archetype.name}</h3>
              <div className={styles.archetypeGrid}>
                <div>
                  <div className={styles.detailLabel}>Core Drive</div>
                  <p className={styles.archetypeVal}>{archetype.coreDrive}</p>
                </div>
                <div>
                  <div className={styles.detailLabel}>Core Fear</div>
                  <p className={styles.archetypeVal}>{archetype.fear}</p>
                </div>
                <div>
                  <div className={styles.detailLabel}>Example Brands</div>
                  <p className={styles.archetypeVal}>{archetype.exampleBrands.join(" · ")}</p>
                </div>
                <div>
                  <div className={styles.detailLabel}>Animation</div>
                  <p className={styles.archetypeVal}>{archetype.animation.easingCharacter}</p>
                </div>
              </div>

              <div className={styles.designConstraints}>
                <div className={styles.detailLabel}>Design Constraints (injected into plan generator)</div>
                <div className={styles.constraintGrid}>
                  {([
                    ["Color", archetype.design.colorPersonality],
                    ["Typography", archetype.design.typographyPersonality],
                    ["Layout", archetype.design.layoutPersonality],
                    ["Voice", archetype.design.toneOfVoice],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className={styles.constraintItem}>
                      <span className={styles.constraintKey}>{k}</span>
                      <span className={styles.constraintVal}>{v}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.avoidList}>
                  <div className={styles.detailLabel} style={{ color: "#FF5050" }}>Avoid in Design</div>
                  {archetype.design.avoidInDesign.map((a) => (
                    <div key={a} className={styles.avoidItem}>
                      <span className={styles.avoidIcon}>✕</span>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sample Briefs */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sample Briefs</h2>
          <p className={styles.sectionDesc}>
            Click <strong style={{ color: "rgba(255,255,255,0.6)" }}>Copy</strong> to paste into the workspace,
            or <strong style={{ color: "var(--status-success)" }}>Run</strong> to open the workspace with this brief pre-filled.
          </p>
          <div className={styles.briefGrid}>
            {SAMPLE_BRIEFS.map((s) => (
              <div key={s.label} className={styles.briefCard}>
                <div className={styles.briefLabel}>{s.label}</div>
                <div className={styles.briefText}>{s.brief.slice(0, 120)}…</div>
                <div className={styles.briefActions}>
                  <button
                    className={styles.briefCopyBtn}
                    onClick={() => copyBrief(s.brief, s.label)}
                  >
                    {copiedBrief === s.label ? "✓ Copied" : "Copy"}
                  </button>
                  <button
                    className={styles.briefRunBtn}
                    onClick={() => runBrief(s.brief)}
                  >
                    Run in workspace →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
