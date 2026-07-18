import Link from "next/link";
import type { ReactNode } from "react";

import { SHIME_BRAND } from "../lib/brand";
import { BrandLogo } from "./brand-logo";

type AppShellProps = Readonly<{
  children: ReactNode;
  variant: "participant" | "public" | "admin";
}>;

const shellLabels = {
  participant: {
    home: null,
    label: SHIME_BRAND.serviceDisplayName,
    context: "PARTICIPANT",
  },
  public: {
    home: null,
    label: SHIME_BRAND.serviceDisplayName,
    context: "EVENT ENTRY",
  },
  admin: {
    home: "/admin",
    label: SHIME_BRAND.adminDisplayName,
    context: "OPERATIONS",
  },
} as const;

export function AppShell({ children, variant }: AppShellProps) {
  const shell = shellLabels[variant];

  return (
    <div className={`app-shell app-shell-${variant}`}>
      <header className="app-header">
        <div className="app-header-inner">
          {shell.home ? (
            <Link className="brand-home-link" href={shell.home} aria-label={`${SHIME_BRAND.platformName} ホーム`}>
              <BrandLogo priority />
            </Link>
          ) : (
            <span className="brand-home-link" aria-label={SHIME_BRAND.platformName}>
              <BrandLogo priority />
            </span>
          )}
          <div className="app-brand-context">
            <span className="app-service-name">{shell.label}</span>
            <span className="app-context-label">{shell.context}</span>
          </div>
        </div>
      </header>
      {children}
      <footer className="app-footer">{SHIME_BRAND.footerLabel}</footer>
    </div>
  );
}
