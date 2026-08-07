import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/auth", () => ({
  requireStaffSession: vi.fn(),
}));

vi.mock("../../apps/web/src/server/match-chat-admin", () => ({
  matchChatAdmin: {
    getWorkspace: { execute: vi.fn() },
    saveConfig: { execute: vi.fn() },
    updateReport: { execute: vi.fn() },
    purgeExpiredMessages: { execute: vi.fn() },
  },
}));

const { requireStaffSession } = await import("../../apps/web/src/server/auth");
const { matchChatAdmin } = await import("../../apps/web/src/server/match-chat-admin");
const { GET, PUT } = await import("../../apps/web/src/app/api/admin/events/[eventId]/match-chat/route");
const { PATCH } = await import("../../apps/web/src/app/api/admin/events/[eventId]/match-chat/reports/[reportId]/route");

const eventId = "10000000-0000-4000-8000-000000000001";
const reportId = "10000000-0000-4000-8000-000000000002";
const session = {
  userId: "staff-a",
  tenantId: "tenant-a",
  displayName: "Manager",
  role: "manager" as const,
  eventId: null,
  permissions: null,
};
const config = {
  enabled: true,
  windowHours: 72,
  messagesPerMinute: 10,
  maxMessageLength: 500,
  termsVersion: "match-chat-v1",
  termsBody: "相手を尊重し、安全に利用してください。",
  retentionDays: 30,
  reportOwnerLabel: "当日運営責任者",
  uatConfirmed: true,
};

beforeEach(() => {
  vi.mocked(requireStaffSession).mockReset().mockResolvedValue(session);
  vi.mocked(matchChatAdmin.getWorkspace.execute).mockReset();
  vi.mocked(matchChatAdmin.saveConfig.execute).mockReset();
  vi.mocked(matchChatAdmin.updateReport.execute).mockReset();
});

describe("match chat admin API", () => {
  it("binds reads to the authenticated tenant and route event", async () => {
    vi.mocked(matchChatAdmin.getWorkspace.execute).mockResolvedValue({ eventName: "Event A", config, reports: [] });
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ eventId }) });
    expect(response.status).toBe(200);
    expect(matchChatAdmin.getWorkspace.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: session.tenantId, eventId, actorUserId: session.userId }),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("validates configuration before calling the save use case", async () => {
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify({ ...config, termsVersion: null, retentionDays: null }),
      }),
      { params: Promise.resolve({ eventId }) },
    );
    expect(response.status).toBe(400);
    expect(matchChatAdmin.saveConfig.execute).not.toHaveBeenCalled();
  });

  it("updates only the report addressed by the event-scoped route", async () => {
    vi.mocked(matchChatAdmin.updateReport.execute).mockResolvedValue({
      id: reportId,
      roomId: "room-a",
      reporterParticipantNumber: "A01",
      reportedParticipantNumber: "B01",
      category: "spam",
      detail: null,
      status: "resolved",
      createdAt: "2026-08-08T08:00:00.000Z",
      resolvedAt: "2026-08-08T09:00:00.000Z",
    });
    const response = await PATCH(
      new Request("https://example.test", { method: "PATCH", body: JSON.stringify({ status: "resolved" }) }),
      { params: Promise.resolve({ eventId, reportId }) },
    );
    expect(response.status).toBe(200);
    expect(matchChatAdmin.updateReport.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: session.tenantId, eventId }),
      reportId,
      { status: "resolved" },
    );
  });
});
