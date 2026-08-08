import { readFile } from "node:fs/promises";
import path from "node:path";

export const MANUALS = {
  admin: {
    title: "管理者・スタッフ操作マニュアル",
    description: "初期設定、当日受付、席配置、結果確定など、運営スタッフ向けの操作手順です。",
    outputName: "SHIME_ADMINISTRATOR_MANUAL.md",
  },
  participant: {
    title: "参加者操作マニュアル",
    description: "申込み、LINE本人連携、SHIME PASS、当日の操作など、参加者向けの案内です。",
    outputName: "SHIME_PARTICIPANT_MANUAL.md",
  },
  clientUat: {
    title: "クライアント確認ガイド",
    description: "本番導線、画面文言、正式イベント情報を確認・承認するためのUAT手順です。",
    outputName: "SHIME_CLIENT_UAT_GUIDE_20260731.md",
  },
} as const;

export type ManualKey = keyof typeof MANUALS;

export function isManualKey(value: string): value is ManualKey {
  return value in MANUALS;
}

export async function readManual(key: ManualKey) {
  const filename = MANUALS[key].outputName;
  const localPath = path.join(process.cwd(), "public", "downloads", filename);
  const rootPath = path.join(process.cwd(), "apps", "web", "public", "downloads", filename);
  try {
    return await readFile(localPath, "utf8");
  } catch {
    return readFile(rootPath, "utf8");
  }
}
