export type RehearsalSeatingSetup = Readonly<{
  eventCode: string;
  externalId: string;
}>;

export function parseRehearsalSeatingSetup(argv: string[]): RehearsalSeatingSetup {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1]?.trim() : undefined;
  };
  const eventCode = value("--event-code");
  const externalId = value("--external-id");
  if (!eventCode || !/^rh-[a-z]-\d{8}$/.test(eventCode)) throw new Error("VALID_REHEARSAL_EVENT_CODE_REQUIRED");
  if (!externalId || !/^RH-[A-Z]\d{2}$/.test(externalId)) throw new Error("VALID_SYNTHETIC_EXTERNAL_ID_REQUIRED");
  return { eventCode, externalId };
}
