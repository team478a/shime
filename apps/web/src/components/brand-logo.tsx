import { SHIME_BRAND } from "../lib/brand";

export function BrandLogo({ priority = false }: { priority?: boolean }) {
  return (
    <span
      className="brand-logo-frame"
      aria-label={SHIME_BRAND.platformName}
      role="img"
      data-priority={priority ? "true" : undefined}
    >
      <svg className="brand-logo-image" viewBox="70 330 950 420" aria-hidden="true" focusable="false">
        <image href="/brand/shime-logo.png" width="1080" height="1080" />
      </svg>
    </span>
  );
}
