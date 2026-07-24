import { z } from "zod";

export const seatingConfigSnapshotSchema = z.record(z.string(), z.unknown());
export const seatingTargetSnapshotSchema = z.record(z.string(), z.unknown());
export const seatingScoreSummarySchema = z.record(z.string(), z.unknown());
export const seatAssignmentExplanationSchema = z.record(z.string(), z.unknown());

export type SeatingScope = {
  tenantId: string;
  eventId: string;
};

export type SeatingRun = {
  id: string;
  tenantId: string;
  eventId: string;
  algorithmVersion: string;
  configSnapshot: Record<string, unknown>;
  targetSnapshot: Record<string, unknown>;
  status: "draft" | "published" | "superseded";
  scoreSummary: Record<string, unknown>;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SeatAssignment = {
  id: string;
  tenantId: string;
  eventId: string;
  seatingRunId: string;
  participantId: string;
  seatId: string | null;
  score: number | null;
  explanation: Record<string, unknown>;
  locked: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SeatingParticipant = {
  id: string;
  participantNumber: string | null;
  fullName: string;
  category: string;
  checkinStatus: "checked_in" | "cancelled" | null;
};

export type SeatingSeat = {
  id: string;
  seatCode: string;
  tableCode: string;
  enabled: boolean;
};

export type SeatingWorkspace = {
  runs: Array<SeatingRun & { assignments: SeatAssignment[] }>;
  participants: SeatingParticipant[];
  seats: SeatingSeat[];
};
