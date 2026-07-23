import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "@shime/core";
import {
  applications,
  checkins,
  eventFormFields,
  events,
  passwordCredentials,
  participants,
  staffRoles,
  tenantModules,
  tenants,
  userIdentities,
  users,
} from "./schema";
import { createDatabase } from "./client";

type EventConfig = {
  event: {
    code: string;
    name: string;
    starts_at: string;
    ends_at: string;
    venue_name: string;
    venue_address: string;
    capacity: number;
  };
  application: { opens_at: string; closes_at: string };
  dream: { registration_mode: "required_private_allowed" | "optional" };
  preference: {
    mode: "mutual_up_to_2" | "first_choice_only" | "ranked_up_to_3";
    opens_at: string;
    closes_at: string;
    allow_multiple_matches: boolean;
  };
  privacy: { event_terms_version: string; privacy_version: string };
  participants: {
    categories: Array<{ code: string; label: string }>;
    participant_number: { group_a_prefix: string; group_b_prefix: string; digits: number };
  };
};

function optionalDate(value: string): Date | null {
  return value.startsWith("REQUIRED_INPUT") ? null : new Date(value);
}

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
const pepper = process.env.PASSWORD_PEPPER;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const demoParticipantCount = Number(process.env.SEED_DEMO_PARTICIPANTS ?? "0");
if (!url || !pepper || !adminPassword)
  throw new Error("DATABASE_MIGRATION_URL (or DATABASE_URL), PASSWORD_PEPPER and SEED_ADMIN_PASSWORD are required");
if (!Number.isInteger(demoParticipantCount) || demoParticipantCount < 0 || demoParticipantCount > 200)
  throw new Error("SEED_DEMO_PARTICIPANTS must be an integer from 0 to 200");
if (demoParticipantCount > 0 && process.env.APP_ENV === "production")
  throw new Error("Demo participants cannot be seeded in production");

const config = parse(await readFile("docs/shime/EVENT_CONFIG_20260808.yaml", "utf8")) as EventConfig;
const { db, client } = createDatabase(url);
const passwordHash = await hashPassword(adminPassword, pepper);

await db.transaction(async (tx) => {
  const [tenant] = await tx
    .insert(tenants)
    .values({ code: "shime", name: "SHIME", timezone: "Asia/Tokyo" })
    .onConflictDoUpdate({ target: tenants.code, set: { name: "SHIME", updatedAt: new Date() } })
    .returning();
  if (!tenant) throw new Error("Failed to seed tenant");
  for (const moduleKey of ["core", "application", "dream", "passport", "seating", "matching"]) {
    await tx.insert(tenantModules).values({ tenantId: tenant.id, moduleKey }).onConflictDoNothing();
  }
  const [event] = await tx
    .insert(events)
    .values({
      tenantId: tenant.id,
      code: config.event.code,
      name: config.event.name,
      status: "draft",
      startsAt: new Date(config.event.starts_at),
      endsAt: optionalDate(config.event.ends_at),
      venueName: config.event.venue_name,
      venueAddress: config.event.venue_address,
      capacity: config.event.capacity,
      applicationOpensAt: optionalDate(config.application.opens_at),
      applicationClosesAt: optionalDate(config.application.closes_at),
      dreamRegistrationMode: config.dream.registration_mode,
      preferenceMode: config.preference.mode,
      allowMultipleMatches: config.preference.allow_multiple_matches,
      preferenceOpensAt: optionalDate(config.preference.opens_at),
      preferenceClosesAt: optionalDate(config.preference.closes_at),
      settings: {
        source: "docs/shime/EVENT_CONFIG_20260808.yaml",
        incomplete: true,
        eventTermsVersion: config.privacy.event_terms_version,
        privacyVersion: config.privacy.privacy_version,
        participantNumber: {
          prefixes: {
            group_a: config.participants.participant_number.group_a_prefix,
            group_b: config.participants.participant_number.group_b_prefix,
          },
          digits: config.participants.participant_number.digits,
        },
      },
    })
    .onConflictDoUpdate({ target: [events.tenantId, events.code], set: { updatedAt: new Date() } })
    .returning();
  if (!event) throw new Error("Failed to seed event");

  const standardFields = [
    ["full_name", "氏名", "text", "required"],
    ["full_name_kana", "氏名かな", "text", "optional"],
    ["birth_date", "生年月日", "date", "required"],
    ["phone", "電話番号", "tel", "required"],
    ["email", "メールアドレス", "email", "optional"],
    ["nickname", "ニックネーム", "text", "optional"],
    ["residence_area", "居住エリア", "text", "optional"],
    ["participant_category", "参加区分", "select", "required"],
  ] as const;
  for (const [fieldKey, label, type, requirement] of standardFields) {
    await tx
      .insert(eventFormFields)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        fieldKey,
        label,
        type,
        requirement,
        displayOrder: standardFields.findIndex((field) => field[0] === fieldKey) + 1,
      })
      .onConflictDoNothing();
  }

  const roleSeeds = ["reception", "operator", "manager", "system_admin"] as const;
  for (const role of roleSeeds) {
    const loginId = `${role}.dev`;
    const identity = await tx
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.tenantId, tenant.id),
          eq(userIdentities.provider, "password"),
          eq(userIdentities.providerUserId, loginId),
        ),
      )
      .limit(1);
    let userId = identity[0]?.userId;
    if (!userId) {
      const [user] = await tx
        .insert(users)
        .values({ tenantId: tenant.id, type: "staff", displayName: `${role} staff` })
        .returning();
      if (!user) throw new Error("Failed to seed staff user");
      userId = user.id;
      await tx
        .insert(userIdentities)
        .values({ tenantId: tenant.id, userId, provider: "password", providerUserId: loginId, verifiedAt: new Date() });
      await tx.insert(passwordCredentials).values({ tenantId: tenant.id, userId, passwordHash });
    }
    await tx
      .insert(staffRoles)
      .values({ tenantId: tenant.id, userId, eventId: role === "system_admin" ? null : event.id, role })
      .onConflictDoNothing();
  }
  for (let index = 1; index <= demoParticipantCount; index++) {
    const padded = String(index).padStart(3, "0");
    const category = index % 2 ? "group_a" : "group_b";
    const [application] = await tx
      .insert(applications)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        source: "csv",
        externalId: `DEMO-${padded}`,
        status: "confirmed",
        fullName: `テスト参加者${padded}`,
        fullNameKana: `てすとさんかしゃ${padded}`,
        birthDate: "1990-01-01",
        nickname: `テスト${padded}`,
        participantCategory: category,
        submittedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [applications.tenantId, applications.eventId, applications.externalId],
        set: { updatedAt: new Date() },
      })
      .returning();
    if (!application) throw new Error("Failed to seed demo application");
    const [participant] = await tx
      .insert(participants)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        applicationId: application.id,
        participantNumber: `${category === "group_a" ? "A" : "B"}${String(Math.ceil(index / 2)).padStart(2, "0")}`,
        status: index > Math.floor(demoParticipantCount * 0.9) ? "absent" : "confirmed",
      })
      .onConflictDoUpdate({
        target: [participants.tenantId, participants.eventId, participants.applicationId],
        set: { updatedAt: new Date() },
      })
      .returning();
    if (participant && index <= Math.floor(demoParticipantCount * 0.6))
      await tx
        .insert(checkins)
        .values({
          tenantId: tenant.id,
          eventId: event.id,
          participantId: participant.id,
          status: "checked_in",
          method: "manual",
          checkedInAt: new Date(),
        })
        .onConflictDoNothing();
  }
});

await client.end();
console.info("Seed completed without logging credentials or personal data.");
