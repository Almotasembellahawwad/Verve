"use client";

import { useEffect, useState } from "react";
import type { GeneratedProject } from "../project/types";
import type { VerveProjectSpec } from "../domain/project-spec";
import type { ProjectRevision } from "../domain/render-receipt";
import { projectRevision } from "../project/project-revision";

export function useProjectRevision(project?: GeneratedProject, spec?: VerveProjectSpec): ProjectRevision | null {
  const [snapshot, setSnapshot] = useState<{ project: GeneratedProject; spec?: VerveProjectSpec; revision: ProjectRevision } | null>(null);
  useEffect(() => {
    if (!project) return;
    let active = true;
    void projectRevision(project, spec).then((revision) => {
      if (active) setSnapshot({ project, spec, revision });
    }).catch(() => { /* Unavailable hashing leaves evidence unbound and readiness provisional. */ });
    return () => { active = false; };
  }, [project, spec]);
  return project && snapshot?.project === project && snapshot.spec === spec ? snapshot.revision : null;
}
