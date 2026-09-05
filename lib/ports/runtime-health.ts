export type RuntimeDependencySnapshot = {
  typographyAssets: "ok" | "missing";
};

export interface RuntimeHealthPort {
  inspect(): Promise<RuntimeDependencySnapshot>;
}
