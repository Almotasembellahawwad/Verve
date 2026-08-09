"use client";

import { useState, useEffect } from "react";
import styles from "./SignalNav.module.css";
import { ApiKeyModal, useApiKey } from "./ApiKeyModal";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#workspace",    label: "Try it" },
  { href: "/showcase",     label: "Showcase" },
  { href: "/docs",         label: "Docs" },
] as const;

export function SignalNav() {
  const [scrolled, setScrolled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { apiKey, saveApiKey } = useApiKey();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change / scroll
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    const openModal = () => setModalOpen(true);
    window.addEventListener("verve:open-api-key-modal", openModal);
    return () => window.removeEventListener("verve:open-api-key-modal", openModal);
  }, []);

  const handleDownloadReadme = () => {
    const link = document.createElement("a");
    link.href = "/api/readme";
    link.download = "VERVE_README.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasKey = !!apiKey;

  return (
    <>
      <nav
        className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}
        aria-label="Main navigation"
      >
        <div className={styles.inner}>
          <a href="/" className={styles.logo} aria-label="Verve home">
            <span className={styles.logoMark} aria-hidden="true">▋</span>
            Verve
          </a>

          {/* Desktop links */}
          <div className={styles.links} aria-label="Site sections">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.link}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className={styles.actions}>
            {/* README Download */}
            <button
              onClick={handleDownloadReadme}
              className={styles.readmeBtn}
              title="Download README with setup instructions"
              aria-label="Download README"
              id="nav-download-readme"
            >
              <DownloadIcon />
              <span className={styles.readmeBtnLabel}>README</span>
            </button>

            {/* API Key Button */}
            <button
              onClick={() => setModalOpen(true)}
              className={`${styles.apiKeyBtn} ${hasKey ? styles.apiKeyBtnActive : ""}`}
              title={hasKey ? "AI provider configured — click to change" : "Configure your AI provider API key"}
              aria-label={hasKey ? "AI key configured" : "Configure AI key"}
              id="nav-api-key"
            >
              <KeyIcon />
              <span className={styles.apiKeyLabel}>
                {hasKey ? (
                  <><span className={styles.keyDot} aria-hidden="true" />Key set</>
                ) : (
                  "Set API key"
                )}
              </span>
            </button>

            <a
              href="https://github.com/mohasbks/Verve"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.githubLink}
              aria-label="View on GitHub"
            >
              <GitHubIcon />
              GitHub
            </a>

            {/* Hamburger — mobile only */}
            <button
              className={styles.hamburger}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              id="nav-hamburger"
            >
              <span className={`${styles.hamburgerLine} ${mobileOpen ? styles.hambTop : ""}`} />
              <span className={`${styles.hamburgerLine} ${mobileOpen ? styles.hambMid : ""}`} />
              <span className={`${styles.hamburgerLine} ${mobileOpen ? styles.hambBot : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className={styles.mobileMenu} role="dialog" aria-modal="true" aria-label="Navigation menu">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.mobileLink}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className={styles.mobileDivider} />
            <a
              href="https://github.com/mohasbks/Verve"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mobileLink}
              onClick={() => setMobileOpen(false)}
            >
              GitHub ↗
            </a>
            <button
              onClick={() => { setModalOpen(true); setMobileOpen(false); }}
              className={styles.mobileLinkBtn}
            >
              {hasKey ? "Change API key" : "Set API key"}
            </button>
          </div>
        )}
      </nav>

      <ApiKeyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveApiKey}
        currentKey={apiKey}
      />
    </>
  );
}

function KeyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2L13 10" />
      <path d="M15 4L19 8" />
      <path d="M13 10L12 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.807 5.625-5.48 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
