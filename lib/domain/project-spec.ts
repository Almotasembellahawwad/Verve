export const VERVE_PROJECT_SPEC_VERSION = 1 as const;

export type VerveProjectFramework = "nextjs" | "react" | "html";

export type ProjectIntentSpec = {
  subject: string;
  audience: string;
  primaryJob: string;
  tone: string;
  industry: string;
  constraints: string[];
};

export type ProjectFact = {
  id: string;
  value: string;
  source: "brief" | "brand-kit";
  mutable: boolean;
};

export type ExperienceSectionRole = "opening" | "evidence" | "offer" | "process" | "decision";

export type ExperienceSection = {
  id: string;
  role: ExperienceSectionRole;
  purpose: string;
  componentIds: string[];
};

export type ProjectComponentKind = "navigation" | "section" | "content" | "media" | "action" | "form";

export type ProjectComponentSpec = {
  id: string;
  sectionId: string;
  kind: ProjectComponentKind;
  responsibility: string;
  children: string[];
};

export type InteractionImplementation = "navigation" | "local-state" | "external-link" | "form-adapter";

export type InteractionContract = {
  id: string;
  componentId: string;
  trigger: string;
  outcome: string;
  implementation: InteractionImplementation;
  requiresExternalAdapter: boolean;
};

export type ResponsiveViewportContract = {
  width: 360 | 768 | 1440;
  label: "mobile" | "tablet" | "desktop";
  requirements: string[];
};

export type VerveProjectSpec = {
  schemaVersion: typeof VERVE_PROJECT_SPEC_VERSION;
  framework: VerveProjectFramework;
  intent: ProjectIntentSpec;
  facts: {
    policy: "brief-is-source-of-truth";
    items: ProjectFact[];
  };
  experience: {
    route: "/";
    sections: ExperienceSection[];
  };
  components: ProjectComponentSpec[];
  interactions: InteractionContract[];
  responsive: {
    viewports: ResponsiveViewportContract[];
    reducedMotionRequired: true;
  };
  visualSystem: {
    colors: { name: string; hex: string; role: string }[];
    typography: { display: string; body: string; rationale: string };
    signature: { name: string; mechanism: string; justification: string };
  };
  media: {
    policy: "required" | "recommended" | "optional" | "avoid";
    minimumAssets: number;
    approvedAssetPaths: string[];
  };
  brand: {
    invariants: string[];
    noveltyLevers: string[];
  };
};

export type ProjectSpecValidation = {
  valid: boolean;
  issues: string[];
};

export function validateVerveProjectSpec(spec: VerveProjectSpec): ProjectSpecValidation {
  const issues: string[] = [];
  const sectionIds = new Set(spec.experience.sections.map((section) => section.id));
  const componentIds = new Set(spec.components.map((component) => component.id));

  if (spec.schemaVersion !== VERVE_PROJECT_SPEC_VERSION) issues.push("Unsupported project specification version.");
  if (spec.experience.sections.length < 3) issues.push("The experience graph requires at least three purposeful sections.");
  if (sectionIds.size !== spec.experience.sections.length) issues.push("Experience section IDs must be unique.");
  if (componentIds.size !== spec.components.length) issues.push("Component IDs must be unique.");
  if (spec.visualSystem.colors.length < 3) issues.push("The visual system requires at least three color tokens.");

  for (const section of spec.experience.sections) {
    if (!section.purpose.trim()) issues.push(`${section.id} has no purpose.`);
    for (const componentId of section.componentIds) {
      if (!componentIds.has(componentId)) issues.push(`${section.id} references unknown component ${componentId}.`);
    }
  }

  for (const component of spec.components) {
    if (!sectionIds.has(component.sectionId)) issues.push(`${component.id} references unknown section ${component.sectionId}.`);
    for (const childId of component.children) {
      if (!componentIds.has(childId)) issues.push(`${component.id} references unknown child ${childId}.`);
    }
  }

  for (const interaction of spec.interactions) {
    if (!componentIds.has(interaction.componentId)) issues.push(`${interaction.id} references unknown component ${interaction.componentId}.`);
    if (interaction.implementation === "form-adapter" && !interaction.requiresExternalAdapter) {
      issues.push(`${interaction.id} must disclose its external form adapter requirement.`);
    }
  }

  const widths = new Set(spec.responsive.viewports.map((viewport) => viewport.width));
  for (const width of [360, 768, 1440] as const) {
    if (!widths.has(width)) issues.push(`Responsive evidence is missing the ${width}px viewport contract.`);
  }

  return { valid: issues.length === 0, issues };
}
