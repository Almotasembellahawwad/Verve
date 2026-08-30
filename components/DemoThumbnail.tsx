import { buildHtmlPreviewDocument } from "@/lib/project/html-preview";
import type { GeneratedProject } from "@/lib/project/types";
import styles from "./DemoThumbnail.module.css";

export function DemoThumbnail({ project }: { project: GeneratedProject }) {
  const document = buildHtmlPreviewDocument(project, `gallery-${project.name}`);
  return (
    <div className={styles.viewport} aria-hidden="true">
      <iframe title="" tabIndex={-1} sandbox="allow-scripts" srcDoc={document} />
    </div>
  );
}
