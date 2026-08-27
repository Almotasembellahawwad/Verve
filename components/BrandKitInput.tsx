"use client";

import { useRef, useState } from "react";
import {
  MAX_OWNED_ASSETS,
  readOwnedAsset,
  type BrandProfile,
  type LocalOwnedAsset,
  type OwnedAssetKind,
} from "@/lib/project/brand-kit";
import styles from "./BrandKitInput.module.css";

type Props = {
  profile: BrandProfile;
  assets: LocalOwnedAsset[];
  disabled?: boolean;
  onProfileChange: (profile: BrandProfile) => void;
  onAssetsChange: (assets: LocalOwnedAsset[]) => void;
};

function parseColors(value: string): string[] {
  return value.split(/[\s,]+/).map((color) => color.trim()).filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 8);
}

export default function BrandKitInput({ profile, assets, disabled, onProfileChange, onAssetsChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState(profile.colors.join(", "));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setAssetError(null);
    try {
      const available = Math.max(0, MAX_OWNED_ASSETS - assets.length);
      const additions = await Promise.all([...files].slice(0, available).map((file) => {
        const kind: OwnedAssetKind = /logo|mark/i.test(file.name) || file.type === "image/svg+xml" ? "logo" : "image";
        return readOwnedAsset(file, kind);
      }));
      const merged = new Map(assets.map((asset) => [asset.path, asset]));
      for (const asset of additions) merged.set(asset.path, asset);
      onAssetsChange([...merged.values()].slice(0, MAX_OWNED_ASSETS));
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : "The browser could not read this asset.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateAsset = (path: string, patch: Partial<LocalOwnedAsset>) => {
    onAssetsChange(assets.map((asset) => asset.path === path ? { ...asset, ...patch } : asset));
  };

  return (
    <details className={styles.panel} open={assets.length > 0 || undefined}>
      <summary>
        <span>Brand kit + owned media</span>
        <small>{assets.length ? `${assets.length}/${MAX_OWNED_ASSETS} local assets` : "Optional · stays in this browser session"}</small>
      </summary>
      <div className={styles.body}>
        <div className={styles.identityGrid}>
          <label>
            <span>Brand name</span>
            <input value={profile.name ?? ""} onChange={(event) => onProfileChange({ ...profile, name: event.target.value })} disabled={disabled} maxLength={120} placeholder="Existing name, if any" />
          </label>
          <label>
            <span>Approved colors</span>
            <input value={colorDraft} onChange={(event) => { setColorDraft(event.target.value); onProfileChange({ ...profile, colors: parseColors(event.target.value) }); }} disabled={disabled} placeholder="#14213D, #FCA311" />
          </label>
          <label className={styles.notes}>
            <span>Identity constraints</span>
            <textarea value={profile.notes ?? ""} onChange={(event) => onProfileChange({ ...profile, notes: event.target.value })} disabled={disabled} maxLength={1200} rows={3} placeholder="Keep the existing mark. Avoid luxury gold. Photography should feel documentary, not staged." />
          </label>
        </div>

        <div className={styles.uploadRow}>
          <div>
            <strong>Owned project assets</strong>
            <p>PNG, JPG, WebP, or SVG · max 1.5 MB each · embedded in preview and ZIP, never sent as binary to the model.</p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || assets.length >= MAX_OWNED_ASSETS}>Add images</button>
          <input ref={inputRef} className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple onChange={(event) => void addFiles(event.target.files)} disabled={disabled} />
        </div>

        {assetError && <p className={styles.error} role="alert">{assetError}</p>}

        {assets.length > 0 && (
          <div className={styles.assetList}>
            {assets.map((asset) => (
              <article key={asset.path}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local upload preview */}
                <img src={`data:${asset.mediaType};base64,${asset.content}`} alt="" />
                <div>
                  <strong>{asset.path.replace("assets/", "")}</strong>
                  <label><span>Role</span><select value={asset.kind} onChange={(event) => updateAsset(asset.path, { kind: event.target.value as OwnedAssetKind })} disabled={disabled}><option value="image">Photography</option><option value="logo">Logo / mark</option></select></label>
                  <label><span>Alt / model direction</span><input value={asset.alt} onChange={(event) => updateAsset(asset.path, { alt: event.target.value.slice(0, 180) })} disabled={disabled} /></label>
                </div>
                <button type="button" onClick={() => onAssetsChange(assets.filter((item) => item.path !== asset.path))} disabled={disabled} aria-label={`Remove ${asset.path}`}>×</button>
              </article>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
