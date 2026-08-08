import { and, eq, ne } from "drizzle-orm";

import { isParticipantNumberForCategory } from "@shime/core/passport/rules";

import {
  applications,
  auditLogs,
  checkinLogs,
  checkins,
  events,
  getDatabase,
  lovePassports,
  participants,
} from "@shime/db";

import type { CheckinRepository } from "./checkin-repository";
import {
  type ConfirmedCheckin,
  participantNumberEventSettingsSchema,
  receptionEventSettingsSchema,
} from "./checkin-types";
import { retainOrAllocateReceptionNumber } from "./reception-number";

export function createDrizzleCheckinRepository(): CheckinRepository {
  return {
    async assignParticipantNumber(input) {
      try {
        return await getDatabase().transaction(async (tx) => {
          const [event] = await tx
            .select({ settings: events.settings })
            .from(events)
            .where(and(eq(events.id, input.eventId), eq(events.tenantId, input.tenantId)))
            .for("update")
            .limit(1);
          if (!event) return { outcome: "not_found" as const };

          const [target] = await tx
            .select({
              participantNumber: participants.participantNumber,
              category: applications.participantCategory,
            })
            .from(participants)
            .innerJoin(
              applications,
              and(
                eq(applications.id, participants.applicationId),
                eq(applications.tenantId, participants.tenantId),
                eq(applications.eventId, participants.eventId),
              ),
            )
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.tenantId, input.tenantId),
                eq(participants.eventId, input.eventId),
              ),
            )
            .limit(1);
          if (!target) return { outcome: "not_found" as const };
          const parsed = participantNumberEventSettingsSchema.safeParse(event.settings);
          if (!parsed.success || parsed.data.participantNumberAssignmentMode !== "manual")
            return { outcome: "automatic_mode" as const };
          if (target.participantNumber === input.participantNumber)
            return { outcome: "assigned" as const, participantNumber: target.participantNumber };
          const prefix =
            target.category === "group_a"
              ? parsed.data.participantNumber.groupAPrefix
              : target.category === "group_b"
                ? parsed.data.participantNumber.groupBPrefix
                : null;
          if (
            !prefix ||
            !isParticipantNumberForCategory(input.participantNumber, prefix, parsed.data.participantNumber.digits)
          )
            return { outcome: "invalid_format" as const };

          const [duplicate] = await tx
            .select({ id: participants.id })
            .from(participants)
            .where(
              and(
                eq(participants.tenantId, input.tenantId),
                eq(participants.eventId, input.eventId),
                eq(participants.participantNumber, input.participantNumber),
                ne(participants.id, input.participantId),
              ),
            )
            .limit(1);
          if (duplicate) return { outcome: "duplicate" as const };

          const [saved] = await tx
            .update(participants)
            .set({ participantNumber: input.participantNumber, updatedAt: input.now })
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.tenantId, input.tenantId),
                eq(participants.eventId, input.eventId),
              ),
            )
            .returning({ participantNumber: participants.participantNumber });
          if (!saved?.participantNumber) return { outcome: "duplicate" as const };

          await tx.insert(auditLogs).values({
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            eventId: input.eventId,
            action: target.participantNumber ? "participant.number.change" : "participant.number.assign",
            targetType: "participant",
            targetId: input.participantId,
            before: target.participantNumber ? { participantNumber: target.participantNumber } : undefined,
            after: { participantNumber: saved.participantNumber },
            requestId: input.requestId,
          });
          return { outcome: "assigned" as const, participantNumber: saved.participantNumber };
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505")
          return { outcome: "duplicate" as const };
        throw error;
      }
    },
    async confirm(input) {
      return getDatabase().transaction(async (tx) => {
        const [event] = await tx
          .select({ settings: events.settings })
          .from(events)
          .where(and(eq(events.id, input.eventId), eq(events.tenantId, input.tenantId)))
          .for("update")
          .limit(1);
        if (!event) return { outcome: "not_found" };

        const [target] = await tx
          .select({ category: applications.participantCategory })
          .from(participants)
          .innerJoin(
            applications,
            and(
              eq(applications.id, participants.applicationId),
              eq(applications.tenantId, participants.tenantId),
              eq(applications.eventId, participants.eventId),
            ),
          )
          .where(
            and(
              eq(participants.id, input.participantId),
              eq(participants.tenantId, input.tenantId),
              eq(participants.eventId, input.eventId),
            ),
          )
          .limit(1);
        if (!target) return { outcome: "not_found" };

        const [existing] = await tx
          .select()
          .from(checkins)
          .where(
            and(
              eq(checkins.tenantId, input.tenantId),
              eq(checkins.eventId, input.eventId),
              eq(checkins.participantId, input.participantId),
            ),
          )
          .limit(1);
        if (existing?.status === "checked_in") {
          return {
            outcome: "already_checked_in",
            checkedInAt: existing.checkedInAt,
          };
        }

        const settings = receptionEventSettingsSchema.parse(event.settings);
        const categoryLabel =
          settings.participantCategories.find((category) => category.code === target.category)?.label ??
          target.category;
        let receptionNumber = existing?.receptionNumber;
        if (!receptionNumber) {
          const current = await tx
            .select({ value: checkins.receptionNumber })
            .from(checkins)
            .where(
              and(
                eq(checkins.tenantId, input.tenantId),
                eq(checkins.eventId, input.eventId),
                eq(checkins.receptionCategory, target.category),
              ),
            );
          receptionNumber = retainOrAllocateReceptionNumber(
            existing?.receptionNumber,
            current.flatMap((row) => (row.value === null ? [] : [row.value])),
          );
        }

        const values = {
          status: "checked_in" as const,
          checkedInAt: input.now,
          checkedInBy: input.actorUserId,
          method: input.method,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          receptionCategory: existing?.receptionCategory ?? target.category,
          receptionCategoryLabel: existing?.receptionCategoryLabel ?? categoryLabel,
          receptionNumber,
          updatedAt: input.now,
        };
        const [saved] = existing
          ? await tx
              .update(checkins)
              .set(values)
              .where(
                and(
                  eq(checkins.id, existing.id),
                  eq(checkins.tenantId, input.tenantId),
                  eq(checkins.eventId, input.eventId),
                  eq(checkins.participantId, input.participantId),
                ),
              )
              .returning()
          : await tx
              .insert(checkins)
              .values({
                tenantId: input.tenantId,
                eventId: input.eventId,
                participantId: input.participantId,
                ...values,
              })
              .returning();
        if (!saved) throw new Error("CHECKIN_FAILED");

        await tx.insert(checkinLogs).values({
          tenantId: input.tenantId,
          eventId: input.eventId,
          participantId: input.participantId,
          checkinId: saved.id,
          action: "confirmed",
          method: input.method,
          actorUserId: input.actorUserId,
        });
        await tx
          .update(lovePassports)
          .set({ status: "checked_in", updatedAt: input.now })
          .where(
            and(
              eq(lovePassports.tenantId, input.tenantId),
              eq(lovePassports.eventId, input.eventId),
              eq(lovePassports.participantId, input.participantId),
            ),
          );
        await tx.insert(auditLogs).values({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          eventId: input.eventId,
          action: "checkin.confirm",
          targetType: "participant",
          targetId: input.participantId,
          after: {
            method: input.method,
            receptionCategory: saved.receptionCategory,
            receptionCategoryLabel: saved.receptionCategoryLabel,
            receptionNumber: saved.receptionNumber,
          },
          requestId: input.requestId,
        });

        return {
          outcome: "confirmed",
          checkin: saved as ConfirmedCheckin,
        };
      });
    },
  };
}
