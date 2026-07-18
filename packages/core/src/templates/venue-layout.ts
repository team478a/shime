import { z } from "zod";

export const VENUE_LAYOUT_MODULE_KEY = "event_operations";
export const VENUE_LAYOUT_TEMPLATE_TYPE = "venue_layout";
export const VENUE_LAYOUT_SCHEMA_VERSION = 1;

export const venueLayoutTableSchema = z.object({
  tableCode: z.string().trim().min(1).max(40),
  capacity: z.number().int().positive().max(50),
  displayOrder: z.number().int().positive().max(200),
  seats: z.array(z.object({ seatCode: z.string().trim().min(1).max(40) })).min(1).max(50),
});

export const venueLayoutPayloadSchema = z.object({
  schemaVersion: z.literal(VENUE_LAYOUT_SCHEMA_VERSION),
  tables: z.array(venueLayoutTableSchema).min(1).max(200),
});

export const venueLayoutTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  tables: z.array(venueLayoutTableSchema).min(1).max(200),
});

export const venueLayoutApplicationInputSchema = z.object({
  tables: z.array(venueLayoutTableSchema).min(1).max(200),
  sourceTemplateId: z.string().uuid().optional(),
});

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalizeVenueLayoutTables(tables: z.infer<typeof venueLayoutTableSchema>[]): string {
  return JSON.stringify([...tables]
    .sort((left, right) => left.displayOrder - right.displayOrder || compareText(left.tableCode, right.tableCode))
    .map((table) => ({
      tableCode: table.tableCode,
      capacity: table.capacity,
      displayOrder: table.displayOrder,
      seats: [...table.seats].sort((left, right) => compareText(left.seatCode, right.seatCode)),
    })));
}

export function nextVenueLayoutTemplateVersion(currentVersion?: number): number {
  if (currentVersion === undefined) return 1;
  if (!Number.isInteger(currentVersion) || currentVersion < 1) throw new Error("Invalid venue layout template version");
  return currentVersion + 1;
}

export type VenueLayoutPayload = z.infer<typeof venueLayoutPayloadSchema>;
