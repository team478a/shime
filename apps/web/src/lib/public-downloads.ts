export type PublicDownload = {
  sourceName: string;
  outputName: string;
  label?: string;
};

export const PUBLIC_DOWNLOADS = [
  {
    sourceName: "COMPLETION_RECORD_20260715.md",
    outputName: "SHIME_COMPLETION_RECORD_20260715.md",
    label: "2026-07-15完了記録",
  },
  {
    sourceName: "CLIENT_DEMO_GUIDE_20260717.md",
    outputName: "SHIME_CLIENT_DEMO_GUIDE_20260717.md",
  },
  {
    sourceName: "REHEARSAL_EXECUTION_RECORD_20260715.md",
    outputName: "SHIME_REHEARSAL_EXECUTION_RECORD_20260715.md",
    label: "実機リハーサル実行記録",
  },
  {
    sourceName: "REHEARSAL_APPLICATIONS_12.csv",
    outputName: "SHIME_REHEARSAL_APPLICATIONS_12.csv",
    label: "合成参加者12名CSV",
  },
  {
    sourceName: "CONCIERGE_SPEC_REVIEW.md",
    outputName: "SHIME_CONCIERGE_SPEC_REVIEW.md",
    label: "AIコンシェルジュ仕様レビュー",
  },
  {
    sourceName: "CONCIERGE_PHASE0_STATUS.md",
    outputName: "SHIME_CONCIERGE_PHASE0_STATUS.md",
    label: "AIコンシェルジュ Phase 0進捗・未決事項",
  },
] as const satisfies readonly PublicDownload[];

export function getAdminPublicDownloads() {
  return PUBLIC_DOWNLOADS.filter((document) => "label" in document);
}
