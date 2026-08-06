import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { applications, dreamProfiles, getDatabase, participants } from "@shime/db";
import { participantIsCheckedIn } from "./drizzle-self-reported-helpers";
import type { InteractionMemoScope, InteractionPublicProfileSource } from "./types";

const answersSchema = z.record(z.string(), z.string());

export async function getTargetPublicProfileSourceWithDrizzle(
  scope: InteractionMemoScope,
  targetParticipantId: string,
): Promise<InteractionPublicProfileSource | null> {
  const [actorCheckedIn, targetCheckedIn] = await Promise.all([
    participantIsCheckedIn(scope, scope.participantId),
    participantIsCheckedIn(scope, targetParticipantId),
  ]);
  if (!actorCheckedIn || !targetCheckedIn) return null;

  const row = (
    await getDatabase()
      .select({
        participantNumber: participants.participantNumber,
        nickname: applications.nickname,
        birthDate: applications.birthDate,
        residenceArea: applications.residenceArea,
        additionalAnswers: applications.additionalAnswers,
        dreamText: dreamProfiles.dreamText,
        dreamVisibility: dreamProfiles.visibility,
      })
      .from(participants)
      .innerJoin(
        applications,
        and(
          eq(applications.tenantId, participants.tenantId),
          eq(applications.eventId, participants.eventId),
          eq(applications.id, participants.applicationId),
        ),
      )
      .leftJoin(
        dreamProfiles,
        and(eq(dreamProfiles.tenantId, participants.tenantId), eq(dreamProfiles.userId, participants.userId)),
      )
      .where(
        and(
          eq(participants.tenantId, scope.tenantId),
          eq(participants.eventId, scope.eventId),
          eq(participants.id, targetParticipantId),
          inArray(participants.status, ["confirmed", "attended"]),
        ),
      )
      .limit(1)
  )[0];
  if (!row?.participantNumber?.trim()) return null;
  return {
    participantNumber: row.participantNumber,
    nickname: row.nickname,
    birthDate: row.birthDate,
    residenceArea: row.residenceArea,
    additionalAnswers: answersSchema.safeParse(row.additionalAnswers).data ?? {},
    publicDream: row.dreamVisibility && row.dreamVisibility !== "private" ? row.dreamText : null,
  };
}
