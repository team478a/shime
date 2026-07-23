import type { Metadata } from "next";
import { SHIME_BRAND } from "../lib/brand";
import "./styles.css";

const isProduction = process.env.APP_ENV === "production";

export const metadata: Metadata = {
  title: SHIME_BRAND.browserTitle,
  description: SHIME_BRAND.browserDescription,
  robots: isProduction ? { index: true, follow: true } : { index: false, follow: false, noarchive: true },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const appEnv = process.env.APP_ENV ?? "development";
  return (
    <html lang="ja" data-service={SHIME_BRAND.serviceKey}>
      <body>
        {appEnv !== "production" && (
          <div className="environment-banner" role="status">
            検証環境（{appEnv}）— 本番データを入力しないでください
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
