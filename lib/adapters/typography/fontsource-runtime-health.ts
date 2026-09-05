import type { RuntimeHealthPort, RuntimeDependencySnapshot } from "../../ports/runtime-health";
import { inspectTypographyRuntime } from "../../engine/typography-delivery";

/** Infrastructure probe kept behind a port so HTTP routes do not reach into the engine. */
export class FontsourceRuntimeHealthAdapter implements RuntimeHealthPort {
  async inspect(): Promise<RuntimeDependencySnapshot> {
    const typography = await inspectTypographyRuntime();
    return { typographyAssets: typography.status };
  }
}
