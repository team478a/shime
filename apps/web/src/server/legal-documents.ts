export const legalDocumentTypes = ["event_terms", "privacy"] as const;
export type LegalDocumentType = (typeof legalDocumentTypes)[number];

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return legalDocumentTypes.includes(value as LegalDocumentType);
}

export function withPublishedLegalVersion(
  settings: Record<string, unknown>,
  documentType: LegalDocumentType,
  version: string,
): Record<string, unknown> {
  return {
    ...settings,
    [documentType === "event_terms" ? "eventTermsVersion" : "privacyVersion"]: version,
  };
}
