import Image from "next/image";

import { SHIME_BRAND } from "../lib/brand";

export function BrandLogo({ priority = false }: { priority?: boolean }) {
  return (
    <span className="brand-logo-crop">
      <Image
        className="brand-logo-image"
        src="/brand/shime-logo.png"
        alt={SHIME_BRAND.platformName}
        width={126}
        height={126}
        priority={priority}
      />
    </span>
  );
}
