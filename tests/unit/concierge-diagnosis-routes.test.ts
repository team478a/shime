import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/participant-auth", () => ({
  requireParticipantForEvent: vi.fn(),
}));

vi.mock("../../apps/web/src/server/auth", () => ({
  requireStaffSession: vi.fn(),
}));

vi.mock("../../apps/web/src/server/concierge-diagnosis-use-cases", () => ({
  getDiagnosis: { execute: vi.fn() },
  startDiagnosis: { execute: vi.fn() },
  saveDiagnosisDraft: { execute: vi.fn() },
  submitDiagnosis: { execute: vi.fn() },
  getDiagnosisCardObjectKey: { execute: vi.fn() },
  getDiagnosisStatusSummary: { execute: vi.fn() },
  updateDiagnosisEventSettings: { execute: vi.fn() },
}));

vi.mock("../../apps/web/src/server/concierge-storage", () => ({
  createConciergeStorageProvider: vi.fn(),
}));

const { requireParticipantForEvent } = await import("../../apps/web/src/server/participant-auth");
const { requireStaffSession } = await import("../../apps/web/src/server/auth");
const useCases = await import("../../apps/web/src/server/concierge-diagnosis-use-cases");
const { createConciergeStorageProvider } = await import("../../apps/web/src/server/concierge-storage");

const { GET: getDiagnosisRoute, PUT: putDiagnosisRoute } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/diagnosis/route");
const { POST: startDiagnosisRoute } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/diagnosis/start/route");
const { POST: submitDiagnosisRoute } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/diagnosis/submit/route");
const { GET: getCardImageRoute } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/diagnosis/cards/[cardVersionId]/image/route");
const { GET: getConciergeStatusRoute, PATCH: patchConciergeStatusRoute } =
  await import("../../apps/web/src/app/api/admin/events/[eventId]/concierge-status/route");

const participantAuth = {
  session: { userId: "user-1", tenantId: "tenant-1" },
  participant: { id: "participant-1", eventId: "event-1" },
};

const staffSession = {
  userId: "staff-1",
  tenantId: "tenant-1",
  displayName: "Manager",
  role: "manager" as const,
  eventId: null,
};

function eventContext(eventId = "event-1") {
  return { params: Promise.resolve({ eventId }) };
}

function getRequest(url = "https://example.test/api/liff/events/event-1/diagnosis") {
  return new Request(url);
}

beforeEach(() => {
  vi.mocked(requireParticipantForEvent)
    .mockReset()
    .mockResolvedValue(participantAuth as never);
  vi.mocked(requireStaffSession)
    .mockReset()
    .mockResolvedValue(staffSession as never);
  vi.mocked(useCases.getDiagnosis.execute).mockReset();
  vi.mocked(useCases.startDiagnosis.execute).mockReset();
  vi.mocked(useCases.saveDiagnosisDraft.execute).mockReset();
  vi.mocked(useCases.submitDiagnosis.execute).mockReset();
  vi.mocked(useCases.getDiagnosisCardObjectKey.execute).mockReset();
  vi.mocked(useCases.getDiagnosisStatusSummary.execute).mockReset();
  vi.mocked(useCases.updateDiagnosisEventSettings.execute).mockReset();
  vi.mocked(createConciergeStorageProvider).mockReset();
});

describe("participant diagnosis API contract", () => {
  it("returns 401 without leaking event details when the caller is not a linked participant", async () => {
    vi.mocked(requireParticipantForEvent).mockRejectedValue(new Error("Not found"));

    const response = await getDiagnosisRoute(getRequest(), eventContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
    expect(useCases.getDiagnosis.execute).not.toHaveBeenCalled();
  });

  it("returns only opaque card backs before a participant selects a card", async () => {
    vi.mocked(useCases.getDiagnosis.execute).mockResolvedValue({
      ok: true,
      data: {
        diagnosis: {
          copy: {},
          reportCopy: {},
          questions: [],
          emotions: [],
          cards: [
            {
              id: "card-1",
              displayOrder: 1,
              storageObjectKey: "concierge/cards/card-1.webp",
              title: "Private title",
              message: "Private message",
              emotionCode: "private-emotion",
              altText: "Private alt text",
            },
          ],
        },
        session: null,
        answers: [],
        result: null,
      },
    } as never);

    const response = await getDiagnosisRoute(getRequest(), eventContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.diagnosis.cards).toEqual([{ id: "card-1", displayOrder: 1 }]);
    expect(body.data.diagnosis).not.toHaveProperty("emotions");
    expect(body.data.diagnosis.selectedCard).toBeNull();
    expect(JSON.stringify(body.data.diagnosis.cards)).not.toMatch(/title|message|emotion|image|storage|alt/i);
  });

  it("returns face data only for the card already selected in the participant session", async () => {
    vi.mocked(useCases.getDiagnosis.execute).mockResolvedValue({
      ok: true,
      data: {
        diagnosis: {
          copy: {},
          reportCopy: {},
          questions: [],
          emotions: [],
          cards: [
            {
              id: "card-1",
              displayOrder: 1,
              storageObjectKey: "concierge/cards/card-1.webp",
              title: "Selected title",
              message: "Selected message",
              emotionCode: "private-emotion",
              altText: "Selected alt text",
            },
            {
              id: "card-2",
              displayOrder: 2,
              storageObjectKey: "concierge/cards/card-2.webp",
              title: "Unselected title",
              message: "Unselected message",
              emotionCode: "another-emotion",
              altText: "Unselected alt text",
            },
          ],
        },
        session: { selectedCardAssetVersionId: "card-1" },
        answers: [],
        result: null,
      },
    } as never);

    const response = await getDiagnosisRoute(getRequest(), eventContext());
    const body = await response.json();

    expect(body.data.diagnosis.cards).toEqual([
      { id: "card-1", displayOrder: 1 },
      { id: "card-2", displayOrder: 2 },
    ]);
    expect(body.data.diagnosis.selectedCard).toEqual({
      id: "card-1",
      title: "Selected title",
      message: "Selected message",
      altText: "Selected alt text",
      displayOrder: 1,
      imageUrl: "/api/liff/events/event-1/diagnosis/cards/card-1/image",
    });
    expect(JSON.stringify(body)).not.toMatch(/Unselected title|Unselected message|another-emotion|storageObjectKey/);
  });

  it("maps a known GetDiagnosis error code to its documented HTTP status", async () => {
    vi.mocked(useCases.getDiagnosis.execute).mockResolvedValue({
      ok: false,
      code: "DIAGNOSIS_NOT_CONFIGURED",
      status: 404,
    } as never);

    const response = await getDiagnosisRoute(getRequest(), eventContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "DIAGNOSIS_NOT_CONFIGURED" });
  });

  it("rejects a malformed draft save body before reaching the use case", async () => {
    const request = new Request("https://example.test/api/liff/events/event-1/diagnosis", {
      method: "PUT",
      body: JSON.stringify({ expectedRevision: -1, selectedCardAssetVersionId: "not-a-uuid", answers: [] }),
    });

    const response = await putDiagnosisRoute(request, eventContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });
    expect(useCases.saveDiagnosisDraft.execute).not.toHaveBeenCalled();
  });

  it("forwards a valid draft save to the use case with the authenticated participant's scope", async () => {
    vi.mocked(useCases.saveDiagnosisDraft.execute).mockResolvedValue({ ok: true, data: { revision: 1 } } as never);
    const input = {
      expectedRevision: 0,
      selectedCardAssetVersionId: "00000000-0000-4000-8000-000000000001",
      answers: [{ axisCode: "axis_1", optionCode: "opt_a" }],
    };
    const request = new Request("https://example.test/api/liff/events/event-1/diagnosis", {
      method: "PUT",
      body: JSON.stringify(input),
    });

    const response = await putDiagnosisRoute(request, eventContext());

    expect(response.status).toBe(200);
    expect(useCases.saveDiagnosisDraft.execute).toHaveBeenCalledWith(
      { tenantId: "tenant-1", eventId: "event-1", participantId: "participant-1", userId: "user-1" },
      input,
    );
  });
});

describe("diagnosis start/submit API contract", () => {
  it("passes an omitted body through as an empty restart request", async () => {
    vi.mocked(useCases.startDiagnosis.execute).mockResolvedValue({
      ok: true,
      data: { session: { id: "session-1" } },
    } as never);
    const request = new Request("https://example.test/api/liff/events/event-1/diagnosis/start", { method: "POST" });

    const response = await startDiagnosisRoute(request, eventContext());

    expect(response.status).toBe(200);
    expect(useCases.startDiagnosis.execute).toHaveBeenCalledWith(
      { tenantId: "tenant-1", eventId: "event-1", participantId: "participant-1", userId: "user-1" },
      {},
    );
  });

  it("maps DIAGNOSIS_ALREADY_SUBMITTED to a 409 conflict", async () => {
    vi.mocked(useCases.startDiagnosis.execute).mockResolvedValue({
      ok: false,
      code: "DIAGNOSIS_ALREADY_SUBMITTED",
      status: 409,
    } as never);
    const request = new Request("https://example.test/api/liff/events/event-1/diagnosis/start", {
      method: "POST",
      body: JSON.stringify({ restart: true }),
    });

    const response = await startDiagnosisRoute(request, eventContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "DIAGNOSIS_ALREADY_SUBMITTED" });
  });

  it("rejects a submit request missing the expected revision", async () => {
    const request = new Request("https://example.test/api/liff/events/event-1/diagnosis/submit", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await submitDiagnosisRoute(request, eventContext());

    expect(response.status).toBe(400);
    expect(useCases.submitDiagnosis.execute).not.toHaveBeenCalled();
  });

  it("returns the deterministic result on a successful submit", async () => {
    const result = { primaryEmotion: { code: "emotion_1" } };
    vi.mocked(useCases.submitDiagnosis.execute).mockResolvedValue({ ok: true, data: { result } } as never);
    const request = new Request("https://example.test/api/liff/events/event-1/diagnosis/submit", {
      method: "POST",
      body: JSON.stringify({ expectedRevision: 0 }),
    });

    const response = await submitDiagnosisRoute(request, eventContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { result } });
  });
});

describe("diagnosis card image authorization contract", () => {
  it("returns 404 without revealing the storage key when the card is not part of the participant's event", async () => {
    vi.mocked(useCases.getDiagnosisCardObjectKey.execute).mockResolvedValue(null);

    const response = await getCardImageRoute(
      new Request("https://example.test/api/liff/events/event-1/diagnosis/cards/card-1/image"),
      { params: Promise.resolve({ eventId: "event-1", cardVersionId: "card-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(JSON.stringify(body)).not.toMatch(/storage|object/i);
    expect(useCases.getDiagnosisCardObjectKey.execute).toHaveBeenCalledWith(
      { tenantId: "tenant-1", eventId: "event-1", participantId: "participant-1", userId: "user-1" },
      "card-1",
    );
  });

  it("redirects to a short-lived signed URL without exposing the raw storage object key", async () => {
    vi.mocked(useCases.getDiagnosisCardObjectKey.execute).mockResolvedValue("concierge/cards/secret-key.webp");
    const createSignedReadUrl = vi.fn().mockResolvedValue("https://storage.test/signed?token=abc");
    vi.mocked(createConciergeStorageProvider).mockReturnValue({
      uploadImmutable: vi.fn(),
      createSignedReadUrl,
    } as never);

    const response = await getCardImageRoute(
      new Request("https://example.test/api/liff/events/event-1/diagnosis/cards/card-1/image"),
      { params: Promise.resolve({ eventId: "event-1", cardVersionId: "card-1" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.test/signed?token=abc");
    expect(response.headers.get("location")).not.toMatch(/secret-key/);
    expect(createSignedReadUrl).toHaveBeenCalledWith("concierge/cards/secret-key.webp", 300);
  });
});

describe("staff concierge status API contract", () => {
  it("returns 401 when no staff session is present", async () => {
    vi.mocked(requireStaffSession).mockRejectedValue(new Error("Unauthorized"));

    const response = await getConciergeStatusRoute(getRequest(), eventContext());

    expect(response.status).toBe(401);
    expect(useCases.getDiagnosisStatusSummary.execute).not.toHaveBeenCalled();
  });

  it("rejects a role without concierge:manage from reading the status summary", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ ...staffSession, role: "reception" } as never);

    const response = await getConciergeStatusRoute(getRequest(), eventContext());

    expect(response.status).toBe(403);
  });

  it("returns the status summary for a permitted staff role", async () => {
    const summary = { eligibleCount: 10, notStartedCount: 3, inProgressCount: 2, submittedCount: 5 };
    vi.mocked(useCases.getDiagnosisStatusSummary.execute).mockResolvedValue(summary);

    const response = await getConciergeStatusRoute(getRequest(), eventContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: summary });
  });

  it("requires the stricter concierge:publish permission to change settings, not just concierge:manage", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ ...staffSession, role: "reception" } as never);
    const request = new Request("https://example.test/api/admin/events/event-1/concierge-status", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        accessOpensAt: null,
        accessClosesAt: null,
        allowResubmission: false,
      }),
    });

    const response = await patchConciergeStatusRoute(request, eventContext());

    expect(response.status).toBe(403);
    expect(useCases.updateDiagnosisEventSettings.execute).not.toHaveBeenCalled();
  });

  it("rejects invalid settings input before calling the use case", async () => {
    const request = new Request("https://example.test/api/admin/events/event-1/concierge-status", {
      method: "PATCH",
      body: JSON.stringify({ enabled: "yes" }),
    });

    const response = await patchConciergeStatusRoute(request, eventContext());

    expect(response.status).toBe(400);
    expect(useCases.updateDiagnosisEventSettings.execute).not.toHaveBeenCalled();
  });

  it("applies valid settings with a manager role holding concierge:publish", async () => {
    vi.mocked(useCases.updateDiagnosisEventSettings.execute).mockResolvedValue({
      ok: true,
      data: { id: "config-1" },
    } as never);
    const request = new Request("https://example.test/api/admin/events/event-1/concierge-status", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        accessOpensAt: "2026-08-01T00:00:00+09:00",
        accessClosesAt: "2026-08-08T00:00:00+09:00",
        allowResubmission: false,
      }),
    });

    const response = await patchConciergeStatusRoute(request, eventContext());

    expect(response.status).toBe(200);
    expect(useCases.updateDiagnosisEventSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", eventId: "event-1", enabled: true, allowResubmission: false }),
    );
  });
});
