import type { GeneratedProject } from "@/lib/project/types";
import { readProjectDesignContract } from "@/lib/project/design-contract";
import { DESIGN_COLOR_ROLES } from "@/lib/domain/design-contract";
import styles from "./DesignChoices.module.css";

export default function DesignChoices({ project }: { project: GeneratedProject }) {
  const contract = readProjectDesignContract(project);
  if (!contract) return null;
  return <details className={styles.choices}>
    <summary>Design choices <span>{contract.spatial.density} · {contract.identity.experienceModel.replaceAll("-", " ")}</span></summary>
    <div className={styles.body}>
      <p className={styles.concept}>{contract.identity.concept}</p>
      <dl className={styles.grid}>
        <div><dt>Display type</dt><dd>{contract.typography.display.split(",")[0].replaceAll('"', "")}</dd></div>
        <div><dt>Reading type</dt><dd>{contract.typography.body.split(",")[0].replaceAll('"', "")}</dd></div>
        <div><dt>Spatial rhythm</dt><dd>{contract.spatial.rhythm}</dd></div>
        <div><dt>Motion</dt><dd>{contract.motion.choreography}</dd></div>
      </dl>
      <ul className={styles.palette} aria-label="Design color roles">{DESIGN_COLOR_ROLES.map((role) => <li key={role}>
        <i aria-hidden="true" style={{ backgroundColor: contract.colorRoles[role] }} />
        <span>{role.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<small>{contract.colorRoles[role]}</small></span>
      </li>)}</ul>
      <p><strong>{contract.identity.signature.name}</strong> — {contract.identity.signature.purpose}</p>
    </div>
  </details>;
}
