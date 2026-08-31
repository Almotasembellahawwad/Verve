import Image from "next/image";
import { buildHtmlPreviewDocument } from "@/lib/project/html-preview";
import type { GeneratedProject } from "@/lib/project/types";
import styles from "./DemoThumbnail.module.css";

export function DemoThumbnail({ project, screenshotPath, eager = false }: { project: GeneratedProject; screenshotPath: string; eager?: boolean }) {
  const document = buildHtmlPreviewDocument(project, `gallery-${project.name}`);
  return (
    <div className={styles.viewport} aria-hidden="true">
      <Image className={styles.screenshot} src={screenshotPath} alt="" width={1200} height={750} sizes="(max-width: 900px) 100vw, 50vw" loading={eager ? "eager" : "lazy"} />
      <iframe className={styles.fingerprintProbe} title="" tabIndex={-1} sandbox="allow-scripts" srcDoc={document} />
    </div>
  );
}
