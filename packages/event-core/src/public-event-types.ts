import { z } from "zod";

export const publicEventFieldValidationSchema = z.record(z.string(), z.unknown());

export type PublicEventRecord = {
  id: string;
  tenantId: string;
  name: string;
  startsAt: Date;
  venueName: string | null;
  venueAddress: string | null;
};

export type PublicEventFormField = {
  id: string;
  tenantId: string;
  eventId: string;
  fieldKey: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select" | "checkbox";
  requirement: "required" | "optional" | "hidden";
  displayOrder: number;
  validation: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicEventView = {
  id: string;
  name: string;
  startsAt: Date;
  venueName: string | null;
  venueAddress: string | null;
  fields: PublicEventFormField[];
};

export type GetPublicEventResult = { ok: true; data: PublicEventView } | { ok: false; code: "NOT_FOUND"; status: 404 };
