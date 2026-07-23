import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const tenantStatus = pgEnum("tenant_status", ["active", "suspended", "archived"]);
export const userStatus = pgEnum("user_status", ["active", "locked", "disabled"]);
export const userType = pgEnum("user_type", ["participant", "staff"]);
export const identityProvider = pgEnum("identity_provider", ["password", "line", "email"]);
export const staffRole = pgEnum("staff_role", ["reception", "operator", "manager", "system_admin"]);
export const eventStatus = pgEnum("event_status", [
  "draft",
  "accepting",
  "registration_closed",
  "checkin_open",
  "in_progress",
  "preference_open",
  "preference_closed",
  "result_confirmed",
  "completed",
]);
export const dreamRegistrationMode = pgEnum("dream_registration_mode", ["required_private_allowed", "optional"]);
export const preferenceMode = pgEnum("preference_mode", ["mutual_up_to_2", "first_choice_only", "ranked_up_to_3"]);
export const fieldRequirement = pgEnum("field_requirement", ["required", "optional", "hidden"]);
export const fieldType = pgEnum("field_type", ["text", "email", "tel", "date", "select", "checkbox"]);
export const applicationSource = pgEnum("application_source", ["shime_form", "csv"]);
export const applicationStatus = pgEnum("application_status", [
  "draft",
  "submitted",
  "confirmed",
  "cancelled",
  "rejected",
  "waitlisted",
]);
export const legalDocumentType = pgEnum("legal_document_type", ["event_terms", "privacy"]);
export const legalDocumentStatus = pgEnum("legal_document_status", ["draft", "published", "retired"]);
export const importStatus = pgEnum("application_import_status", [
  "validating",
  "validated",
  "committing",
  "completed",
  "failed",
]);
export const importRowLevel = pgEnum("application_import_row_level", ["valid", "warning", "error"]);
export const duplicateResolution = pgEnum("duplicate_resolution", [
  "pending",
  "same_person",
  "different_person",
  "on_hold",
]);
export const participantStatus = pgEnum("participant_status", [
  "invited",
  "confirmed",
  "cancelled",
  "absent",
  "attended",
]);
export const webhookStatus = pgEnum("line_webhook_status", ["received", "processed", "ignored", "failed"]);
export const notificationStatus = pgEnum("notification_status", ["queued", "sending", "sent", "failed", "cancelled"]);
export const dreamState = pgEnum("dream_state", ["not_started", "drafting", "confirmed", "skipped"]);
export const dreamVisibility = pgEnum("dream_visibility", ["nickname_and_dream", "dream_only", "private"]);
export const passportStatus = pgEnum("passport_status", [
  "issued",
  "ready",
  "checked_in",
  "preference_submitted",
  "result_available",
  "completed",
]);
export const checkinStatus = pgEnum("checkin_status", ["checked_in", "cancelled"]);
export const checkinMethod = pgEnum("checkin_method", ["qr", "manual"]);
export const questionnaireStatus = pgEnum("questionnaire_status", ["draft", "submitted"]);
export const seatingRunStatus = pgEnum("seating_run_status", ["draft", "published", "superseded"]);
export const preferenceSubmissionStatus = pgEnum("preference_submission_status", ["draft", "submitted"]);
export const matchCandidateStatus = pgEnum("match_candidate_status", [
  "candidate",
  "pending",
  "approved",
  "declined",
  "revoked",
]);
export const conciergeVersionStatus = pgEnum("concierge_version_status", ["draft", "published", "archived"]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    status: tenantStatus("status").default("active").notNull(),
    timezone: varchar("timezone", { length: 64 }).default("Asia/Tokyo").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tenants_code_uidx").on(table.code)],
);

export const tenantModules = pgTable(
  "tenant_modules",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    moduleKey: varchar("module_key", { length: 80 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.moduleKey] })],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: userType("user_type").notNull(),
    status: userStatus("status").default("active").notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("users_tenant_idx").on(table.tenantId)],
);

export const userIdentities = pgTable(
  "user_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: identityProvider("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_identities_tenant_provider_uidx").on(table.tenantId, table.provider, table.providerUserId),
    index("user_identities_user_idx").on(table.tenantId, table.userId),
  ],
);

export const passwordCredentials = pgTable("password_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  passwordHash: text("password_hash").notNull(),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).defaultNow().notNull(),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps,
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 240 }).notNull(),
    status: eventStatus("status").default("draft").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    venueName: varchar("venue_name", { length: 240 }),
    venueAddress: text("venue_address"),
    capacity: integer("capacity").notNull(),
    applicationOpensAt: timestamp("application_opens_at", { withTimezone: true }),
    applicationClosesAt: timestamp("application_closes_at", { withTimezone: true }),
    dreamRegistrationMode: dreamRegistrationMode("dream_registration_mode").notNull(),
    preferenceMode: preferenceMode("preference_mode").notNull(),
    allowMultipleMatches: boolean("allow_multiple_matches").default(false).notNull(),
    preferenceOpensAt: timestamp("preference_opens_at", { withTimezone: true }),
    preferenceClosesAt: timestamp("preference_closes_at", { withTimezone: true }),
    resultPublishAt: timestamp("result_publish_at", { withTimezone: true }),
    settings: jsonb("settings_json").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("events_tenant_code_uidx").on(table.tenantId, table.code),
    index("events_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const staffRoles = pgTable(
  "staff_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    eventId: uuid("event_id").references(() => events.id),
    role: staffRole("role").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("staff_roles_scope_uidx").on(table.tenantId, table.userId, table.eventId, table.role)],
);

export const eventFormFields = pgTable(
  "event_form_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    fieldKey: varchar("field_key", { length: 80 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    type: fieldType("field_type").notNull(),
    requirement: fieldRequirement("requirement").notNull(),
    displayOrder: integer("display_order").notNull(),
    validation: jsonb("validation_json").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("event_form_fields_key_uidx").on(table.tenantId, table.eventId, table.fieldKey)],
);

export const eventTables = pgTable(
  "event_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    tableCode: varchar("table_code", { length: 40 }).notNull(),
    capacity: integer("capacity").notNull(),
    displayOrder: integer("display_order").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("event_tables_code_uidx").on(table.tenantId, table.eventId, table.tableCode)],
);

export const eventSeats = pgTable(
  "event_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    tableId: uuid("table_id")
      .notNull()
      .references(() => eventTables.id),
    seatCode: varchar("seat_code", { length: 40 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("event_seats_code_uidx").on(table.tenantId, table.eventId, table.seatCode)],
);

export const consents = pgTable("consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  eventId: uuid("event_id").references(() => events.id),
  consentType: varchar("consent_type", { length: 80 }).notNull(),
  documentVersion: varchar("document_version", { length: 80 }).notNull(),
  accepted: boolean("accepted").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  ipHash: varchar("ip_hash", { length: 128 }),
  ...timestamps,
});

export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("staff_sessions_token_uidx").on(table.tokenHash),
    index("staff_sessions_user_idx").on(table.tenantId, table.userId),
  ],
);

export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  loginIdHash: varchar("login_id_hash", { length: 64 }).notNull(),
  success: boolean("success").notNull(),
  ipHash: varchar("ip_hash", { length: 64 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    eventId: uuid("event_id").references(() => events.id),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: uuid("target_id"),
    before: jsonb("before_json").$type<Record<string, unknown>>(),
    after: jsonb("after_json").$type<Record<string, unknown>>(),
    reason: text("reason"),
    requestId: uuid("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_logs_tenant_event_idx").on(table.tenantId, table.eventId, table.createdAt)],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    source: applicationSource("source").notNull(),
    externalId: varchar("external_id", { length: 160 }),
    status: applicationStatus("status").notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    fullNameKana: varchar("full_name_kana", { length: 160 }),
    phone: varchar("phone", { length: 40 }),
    phoneNormalized: varchar("phone_normalized", { length: 32 }),
    email: varchar("email", { length: 320 }),
    emailNormalized: varchar("email_normalized", { length: 320 }),
    birthDate: varchar("birth_date", { length: 10 }).notNull(),
    nickname: varchar("nickname", { length: 120 }),
    residenceArea: varchar("residence_area", { length: 240 }),
    participantCategory: varchar("participant_category", { length: 80 }).notNull(),
    notes: text("notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    idempotencyKeyHash: varchar("idempotency_key_hash", { length: 64 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("applications_event_external_uidx").on(table.tenantId, table.eventId, table.externalId),
    uniqueIndex("applications_idempotency_uidx").on(table.tenantId, table.eventId, table.idempotencyKeyHash),
    index("applications_phone_idx").on(table.tenantId, table.eventId, table.phoneNormalized),
    index("applications_email_idx").on(table.tenantId, table.eventId, table.emailNormalized),
  ],
);

export const applicationConsents = pgTable(
  "application_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    consentType: varchar("consent_type", { length: 80 }).notNull(),
    documentVersion: varchar("document_version", { length: 80 }).notNull(),
    accepted: boolean("accepted").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("application_consents_type_uidx").on(
      table.tenantId,
      table.applicationId,
      table.consentType,
      table.documentVersion,
    ),
  ],
);

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    documentType: legalDocumentType("document_type").notNull(),
    version: varchar("version", { length: 80 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body").notNull(),
    status: legalDocumentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_documents_version_uidx").on(table.tenantId, table.eventId, table.documentType, table.version),
    index("legal_documents_status_idx").on(table.tenantId, table.eventId, table.documentType, table.status),
  ],
);

export const applicationImports = pgTable(
  "application_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    originalFileKey: text("original_file_key").notNull(),
    originalFileHash: varchar("original_file_hash", { length: 64 }).notNull(),
    status: importStatus("status").notNull(),
    mode: varchar("mode", { length: 20 }).notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    successRows: integer("success_rows").default(0).notNull(),
    warningRows: integer("warning_rows").default(0).notNull(),
    errorRows: integer("error_rows").default(0).notNull(),
    mapping: jsonb("mapping_json").$type<Record<string, string>>().default({}).notNull(),
    importedBy: uuid("imported_by")
      .notNull()
      .references(() => users.id),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("application_imports_file_uidx").on(table.tenantId, table.eventId, table.originalFileHash)],
);

export const applicationImportRows = pgTable(
  "application_import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    importId: uuid("import_id")
      .notNull()
      .references(() => applicationImports.id),
    rowNumber: integer("row_number").notNull(),
    level: importRowLevel("level").notNull(),
    externalId: varchar("external_id", { length: 160 }),
    normalizedData: jsonb("normalized_data_json").$type<Record<string, unknown>>().notNull(),
    issues: jsonb("issues_json").$type<Array<{ column: string; code: string }>>().default([]).notNull(),
    committedApplicationId: uuid("committed_application_id").references(() => applications.id),
    ...timestamps,
  },
  (table) => [uniqueIndex("application_import_rows_number_uidx").on(table.tenantId, table.importId, table.rowNumber)],
);

export const duplicateCandidates = pgTable(
  "duplicate_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    candidateApplicationId: uuid("candidate_application_id")
      .notNull()
      .references(() => applications.id),
    reasons: jsonb("reasons_json").$type<string[]>().notNull(),
    resolution: duplicateResolution("resolution").default("pending").notNull(),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("duplicate_candidates_pair_uidx").on(
      table.tenantId,
      table.eventId,
      table.applicationId,
      table.candidateApplicationId,
    ),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    userId: uuid("user_id").references(() => users.id),
    participantNumber: varchar("participant_number", { length: 40 }),
    status: participantStatus("status").default("confirmed").notNull(),
    linkTokenHash: varchar("link_token_hash", { length: 64 }),
    linkTokenExpiresAt: timestamp("link_token_expires_at", { withTimezone: true }),
    linkTokenUsedAt: timestamp("link_token_used_at", { withTimezone: true }),
    dreamState: dreamState("dream_state").default("not_started").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("participants_application_uidx").on(table.tenantId, table.eventId, table.applicationId),
    uniqueIndex("participants_user_uidx").on(table.tenantId, table.eventId, table.userId),
    uniqueIndex("participants_number_uidx").on(table.tenantId, table.eventId, table.participantNumber),
    uniqueIndex("participants_link_token_uidx").on(table.linkTokenHash),
  ],
);

export const participantSessions = pgTable(
  "participant_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("participant_sessions_token_uidx").on(table.tokenHash),
    index("participant_sessions_user_idx").on(table.tenantId, table.userId),
  ],
);

export const lineWebhookEvents = pgTable(
  "line_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    webhookEventId: varchar("webhook_event_id", { length: 160 }).notNull(),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    lineUserIdHash: varchar("line_user_id_hash", { length: 64 }),
    status: webhookStatus("status").default("received").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 120 }),
    ...timestamps,
  },
  (table) => [uniqueIndex("line_webhook_event_uidx").on(table.tenantId, table.webhookEventId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 80 }).notNull(),
    channel: varchar("channel", { length: 40 }).default("line").notNull(),
    status: notificationStatus("status").default("queued").notNull(),
    dedupeKey: varchar("dedupe_key", { length: 160 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    payload: jsonb("payload_snapshot_json").$type<Record<string, unknown>>().notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notifications_dedupe_uidx").on(table.tenantId, table.eventId, table.dedupeKey),
    index("notifications_queue_idx").on(table.tenantId, table.status, table.scheduledAt),
  ],
);

export const notificationAttempts = pgTable(
  "notification_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id),
    attemptNumber: integer("attempt_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: notificationStatus("status").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 160 }),
    errorCode: varchar("error_code", { length: 120 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_attempt_number_uidx").on(table.tenantId, table.notificationId, table.attemptNumber),
  ],
);

export const emotionCardSets = pgTable(
  "emotion_card_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    version: integer("version").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("emotion_card_sets_code_version_uidx").on(table.tenantId, table.code, table.version)],
);

export const emotionCards = pgTable(
  "emotion_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    cardSetId: uuid("card_set_id")
      .notNull()
      .references(() => emotionCardSets.id),
    name: varchar("name", { length: 120 }).notNull(),
    imageKey: text("image_key"),
    description: text("description"),
    displayOrder: integer("display_order").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("emotion_cards_order_uidx").on(table.tenantId, table.cardSetId, table.displayOrder)],
);

export const eventDreamSettings = pgTable("event_dream_settings", {
  eventId: uuid("event_id")
    .primaryKey()
    .references(() => events.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  cardSetId: uuid("card_set_id").references(() => emotionCardSets.id),
  aiEnabled: boolean("ai_enabled").default(false).notNull(),
  aiTimeoutMs: integer("ai_timeout_ms").default(10_000).notNull(),
  fallbackBridgeTemplate: text("fallback_bridge_template").notNull(),
  fallbackCandidates: jsonb("fallback_candidates_json").$type<string[]>().notNull(),
  projectConsentVersion: varchar("project_consent_version", { length: 80 }),
  ...timestamps,
});

export const emotionSelections = pgTable(
  "emotion_selections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    emotionCardId: uuid("emotion_card_id")
      .notNull()
      .references(() => emotionCards.id),
    firstImpression: varchar("first_impression", { length: 500 }).notNull(),
    relatedArea: varchar("related_area", { length: 500 }).notNull(),
    underlyingWish: varchar("underlying_wish", { length: 500 }).notNull(),
    freeText: text("free_text"),
    redrawCount: integer("redraw_count").default(0).notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("emotion_selections_participant_uidx").on(table.tenantId, table.eventId, table.participantId),
  ],
);

export const dreamProfiles = pgTable(
  "dream_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    dreamNo: varchar("dream_no", { length: 20 }).notNull(),
    dreamText: varchar("dream_text", { length: 500 }).notNull(),
    visibility: dreamVisibility("visibility").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("dream_profiles_user_uidx").on(table.tenantId, table.userId),
    uniqueIndex("dream_profiles_number_uidx").on(table.dreamNo),
  ],
);

export const lovePassports = pgTable(
  "love_passports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: passportStatus("status").default("issued").notNull(),
    qrTokenHash: varchar("qr_token_hash", { length: 64 }),
    qrVersion: integer("qr_version").default(0).notNull(),
    qrIssuedAt: timestamp("qr_issued_at", { withTimezone: true }),
    qrExpiresAt: timestamp("qr_expires_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("love_passports_participant_uidx").on(table.tenantId, table.eventId, table.participantId),
    uniqueIndex("love_passports_qr_uidx").on(table.qrTokenHash),
  ],
);

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: checkinStatus("status").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: uuid("checked_in_by").references(() => users.id),
    method: checkinMethod("method").notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancellationReason: text("cancellation_reason"),
    ...timestamps,
  },
  (table) => [uniqueIndex("checkins_participant_uidx").on(table.tenantId, table.eventId, table.participantId)],
);

export const checkinLogs = pgTable(
  "checkin_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    checkinId: uuid("checkin_id").references(() => checkins.id),
    action: varchar("action", { length: 40 }).notNull(),
    method: checkinMethod("method").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("checkin_logs_participant_idx").on(table.tenantId, table.eventId, table.participantId, table.createdAt),
  ],
);

export const questionnaires = pgTable(
  "questionnaires",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("questionnaires_code_uidx").on(table.tenantId, table.code)],
);

export const questionnaireVersions = pgTable(
  "questionnaire_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    questionnaireId: uuid("questionnaire_id")
      .notNull()
      .references(() => questionnaires.id),
    version: integer("version").notNull(),
    active: boolean("active").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("questionnaire_versions_number_uidx").on(table.tenantId, table.questionnaireId, table.version),
  ],
);

export const questionnaireQuestions = pgTable(
  "questionnaire_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => questionnaireVersions.id),
    axis: varchar("axis", { length: 40 }).notNull(),
    prompt: varchar("prompt", { length: 300 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    maxSelections: integer("max_selections").default(1).notNull(),
    displayOrder: integer("display_order").notNull(),
    weight: integer("weight").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("questionnaire_questions_axis_uidx").on(table.tenantId, table.versionId, table.axis),
    uniqueIndex("questionnaire_questions_order_uidx").on(table.tenantId, table.versionId, table.displayOrder),
  ],
);

export const questionnaireOptions = pgTable(
  "questionnaire_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionnaireQuestions.id),
    code: varchar("code", { length: 80 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    scoreValue: integer("score_value"),
    displayOrder: integer("display_order").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("questionnaire_options_code_uidx").on(table.tenantId, table.questionId, table.code)],
);

export const eventQuestionnaires = pgTable("event_questionnaires", {
  eventId: uuid("event_id")
    .primaryKey()
    .references(() => events.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  versionId: uuid("version_id")
    .notNull()
    .references(() => questionnaireVersions.id),
  ...timestamps,
});

export const questionnaireResponses = pgTable(
  "questionnaire_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => questionnaireVersions.id),
    status: questionnaireStatus("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("questionnaire_responses_participant_uidx").on(table.tenantId, table.eventId, table.participantId),
  ],
);

export const questionnaireAnswers = pgTable(
  "questionnaire_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    responseId: uuid("response_id")
      .notNull()
      .references(() => questionnaireResponses.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionnaireQuestions.id),
    optionCodes: jsonb("option_codes_json").$type<string[]>().default([]).notNull(),
    declined: boolean("declined").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("questionnaire_answers_question_uidx").on(table.tenantId, table.responseId, table.questionId),
  ],
);

export const participantAvoidances = pgTable(
  "participant_avoidances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    avoidedParticipantId: uuid("avoided_participant_id")
      .notNull()
      .references(() => participants.id),
    kind: varchar("kind", { length: 40 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("participant_avoidances_pair_uidx").on(
      table.tenantId,
      table.eventId,
      table.participantId,
      table.avoidedParticipantId,
    ),
  ],
);

export const seatingRuns = pgTable(
  "seating_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    algorithmVersion: varchar("algorithm_version", { length: 40 }).notNull(),
    configSnapshot: jsonb("config_snapshot_json").$type<Record<string, unknown>>().notNull(),
    targetSnapshot: jsonb("target_snapshot_json").$type<Record<string, unknown>>().notNull(),
    status: seatingRunStatus("status").default("draft").notNull(),
    scoreSummary: jsonb("score_summary_json").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    publishedBy: uuid("published_by").references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("seating_runs_event_idx").on(table.tenantId, table.eventId, table.createdAt)],
);

export const seatAssignments = pgTable(
  "seat_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    seatingRunId: uuid("seating_run_id")
      .notNull()
      .references(() => seatingRuns.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    seatId: uuid("seat_id").references(() => eventSeats.id),
    score: integer("score"),
    explanation: jsonb("explanation_json").$type<Record<string, unknown>>().notNull(),
    locked: boolean("locked").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("seat_assignments_participant_uidx").on(table.tenantId, table.seatingRunId, table.participantId),
    uniqueIndex("seat_assignments_seat_uidx").on(table.tenantId, table.seatingRunId, table.seatId),
  ],
);

export const conversationPairs = pgTable(
  "conversation_pairs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantAId: uuid("participant_a_id")
      .notNull()
      .references(() => participants.id),
    participantBId: uuid("participant_b_id")
      .notNull()
      .references(() => participants.id),
    roundNo: integer("round_no"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("conversation_pairs_round_uidx").on(
      table.tenantId,
      table.eventId,
      table.participantAId,
      table.participantBId,
      table.roundNo,
    ),
  ],
);

export const preferenceSubmissions = pgTable(
  "preference_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: preferenceSubmissionStatus("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("preference_submissions_participant_uidx").on(table.tenantId, table.eventId, table.participantId),
  ],
);

export const preferences = pgTable(
  "preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => preferenceSubmissions.id),
    fromParticipantId: uuid("from_participant_id")
      .notNull()
      .references(() => participants.id),
    toParticipantId: uuid("to_participant_id")
      .notNull()
      .references(() => participants.id),
    rank: integer("rank"),
    privateNote: text("private_note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("preferences_pair_uidx").on(
      table.tenantId,
      table.eventId,
      table.fromParticipantId,
      table.toParticipantId,
    ),
    uniqueIndex("preferences_rank_uidx").on(table.tenantId, table.eventId, table.fromParticipantId, table.rank),
  ],
);

export const matchCandidates = pgTable(
  "match_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    participantAId: uuid("participant_a_id")
      .notNull()
      .references(() => participants.id),
    participantBId: uuid("participant_b_id")
      .notNull()
      .references(() => participants.id),
    aRank: integer("a_rank"),
    bRank: integer("b_rank"),
    status: matchCandidateStatus("status").default("candidate").notNull(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("match_candidates_pair_uidx").on(
      table.tenantId,
      table.eventId,
      table.participantAId,
      table.participantBId,
    ),
  ],
);

export const resultConfirmations = pgTable(
  "result_confirmations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    confirmedBy: uuid("confirmed_by")
      .notNull()
      .references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
    approvedCount: integer("approved_count").notNull(),
    participantCount: integer("participant_count").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id),
    revocationReason: text("revocation_reason"),
    ...timestamps,
  },
  (table) => [index("result_confirmations_event_idx").on(table.tenantId, table.eventId, table.confirmedAt)],
);

export const tenantServiceSettings = pgTable(
  "tenant_service_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceKey: varchar("service_key", { length: 80 }).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    config: jsonb("config_json").$type<Record<string, unknown>>().default({}).notNull(),
    encryptedSecrets: text("encrypted_secrets"),
    secretFingerprint: varchar("secret_fingerprint", { length: 16 }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastCheckStatus: varchar("last_check_status", { length: 40 }),
    lastCheckCode: varchar("last_check_code", { length: 120 }),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [uniqueIndex("tenant_service_settings_key_uidx").on(table.tenantId, table.serviceKey)],
);

export const tenantOperationalSettings = pgTable("tenant_operational_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  customDomain: varchar("custom_domain", { length: 255 }),
  healthcheckUrl: text("healthcheck_url"),
  monitoringEnabled: boolean("monitoring_enabled").default(true).notNull(),
  notificationFailureThreshold: integer("notification_failure_threshold").default(1).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  ...timestamps,
});

export const jobSchedules = pgTable(
  "job_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    jobKey: varchar("job_key", { length: 80 }).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    cronExpression: varchar("cron_expression", { length: 120 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).default("Asia/Tokyo").notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: varchar("last_run_status", { length: 40 }),
    lastRunSummary: jsonb("last_run_summary_json").$type<Record<string, unknown>>(),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [uniqueIndex("job_schedules_key_uidx").on(table.tenantId, table.jobKey)],
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    templateKey: varchar("template_key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    body: text("body").notNull(),
    version: integer("version").notNull(),
    active: boolean("active").default(true).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_templates_version_uidx").on(table.tenantId, table.templateKey, table.version),
    index("notification_templates_active_idx").on(table.tenantId, table.templateKey, table.active),
  ],
);

export const resourceTemplates = pgTable(
  "resource_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    moduleKey: varchar("module_key", { length: 80 }).notNull(),
    templateType: varchar("template_type", { length: 80 }).notNull(),
    templateKey: varchar("template_key", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").default(1).notNull(),
    payload: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    active: boolean("active").default(true).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("resource_templates_version_uidx").on(
      table.tenantId,
      table.moduleKey,
      table.templateType,
      table.templateKey,
      table.version,
    ),
    index("resource_templates_active_idx").on(table.tenantId, table.moduleKey, table.templateType, table.active),
  ],
);

export const resourceTemplateApplications = pgTable(
  "resource_template_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    moduleKey: varchar("module_key", { length: 80 }).notNull(),
    templateType: varchar("template_type", { length: 80 }).notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => resourceTemplates.id),
    templateVersion: integer("template_version").notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: uuid("target_id").notNull(),
    appliedSnapshot: jsonb("applied_snapshot_json").$type<Record<string, unknown>>().notNull(),
    snapshotHash: varchar("snapshot_hash", { length: 64 }).notNull(),
    appliedBy: uuid("applied_by")
      .notNull()
      .references(() => users.id),
    appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("resource_template_applications_template_idx").on(table.tenantId, table.templateId, table.appliedAt),
    index("resource_template_applications_target_idx").on(
      table.tenantId,
      table.moduleKey,
      table.targetType,
      table.targetId,
    ),
  ],
);

export const conciergeCardAssets = pgTable(
  "concierge_card_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    moduleKey: varchar("module_key", { length: 80 }).default("concierge").notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("concierge_card_assets_code_uidx").on(table.tenantId, table.moduleKey, table.code),
    index("concierge_card_assets_tenant_idx").on(table.tenantId, table.moduleKey, table.archivedAt),
  ],
);

export const conciergeCardAssetVersions = pgTable(
  "concierge_card_asset_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => conciergeCardAssets.id),
    version: integer("version").notNull(),
    status: conciergeVersionStatus("status").default("draft").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    altText: varchar("alt_text", { length: 500 }).notNull(),
    storageObjectKey: text("storage_object_key").notNull(),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    pixelCount: integer("pixel_count").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("concierge_card_asset_versions_number_uidx").on(table.tenantId, table.assetId, table.version),
    uniqueIndex("concierge_card_asset_versions_hash_uidx").on(table.tenantId, table.contentHash),
    index("concierge_card_asset_versions_status_idx").on(table.tenantId, table.status, table.createdAt),
  ],
);

export const conciergeTemplates = pgTable(
  "concierge_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    moduleKey: varchar("module_key", { length: 80 }).default("concierge").notNull(),
    templateKey: varchar("template_key", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("concierge_templates_key_uidx").on(table.tenantId, table.moduleKey, table.templateKey),
    index("concierge_templates_tenant_idx").on(table.tenantId, table.moduleKey, table.archivedAt),
  ],
);

export const conciergeTemplateVersions = pgTable(
  "concierge_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => conciergeTemplates.id),
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").default(1).notNull(),
    status: conciergeVersionStatus("status").default("draft").notNull(),
    payload: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("concierge_template_versions_number_uidx").on(table.tenantId, table.templateId, table.version),
    index("concierge_template_versions_status_idx").on(table.tenantId, table.templateId, table.status),
  ],
);

export const eventConciergeSnapshots = pgTable(
  "event_concierge_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => conciergeTemplateVersions.id),
    templateVersion: integer("template_version").notNull(),
    snapshot: jsonb("snapshot_json").$type<Record<string, unknown>>().notNull(),
    snapshotHash: varchar("snapshot_hash", { length: 64 }).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    appliedBy: uuid("applied_by")
      .notNull()
      .references(() => users.id),
    appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_concierge_snapshots_event_uidx").on(table.tenantId, table.eventId),
    index("event_concierge_snapshots_version_idx").on(table.tenantId, table.templateVersionId),
  ],
);
