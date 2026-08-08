import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/auth", () => ({ requireStaffSession: vi.fn() }));
vi.mock("../../apps/web/src/server/operations-analytics", () => ({
  operationsAnalytics: { execute: vi.fn() },
}));

const { requireStaffSession } = await import("../../apps/web/src/server/auth");
const { operationsAnalytics } = await import("../../apps/web/src/server/operations-analytics");
const { GET } = await import("../../apps/web/src/app/api/admin/events/[eventId]/communication-analytics/route");

const eventId = "10000000-0000-4000-8000-000000000001";
const session = {
  userId: "staff-a",
  tenantId: "tenant-a",
  displayName: "Operator",
  role: "operator" as const,
  eventId: null,
  permissions: ["operations:read"] as Array<"operations:read">,
};

beforeEach(() => {
  vi.mocked(requireStaffSession).mockReset().mockResolvedValue(session);
  vi.mocked(operationsAnalytics.execute)
    .mockReset()
    .mockResolvedValue({
      eventName: "Event A",
      privacy: { minimumCohortSize: 5, minimumCellSize: 3 },
      interaction: { available: false, cohortSize: null, metrics: {}, distribution: [] },
      matchChat: { available: false, cohortSize: null, metrics: {}, distribution: [] },
    });
});

describe("operations analytics API", () => {
  it("uses only the authenticated tenant and route event scope", async () => {
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ eventId }) });
    expect(response.status).toBe(200);
    expect(operationsAnalytics.execute).toHaveBeenCalledWith({
      tenantId: session.tenantId,
      eventId,
      serviceType: "marriage",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects staff without operations read permission", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ ...session, permissions: [] });
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ eventId }) });
    expect(response.status).toBe(403);
    expect(operationsAnalytics.execute).not.toHaveBeenCalled();
  });

  it("does not accept a different event than an event-scoped staff session", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ ...session, eventId: "another-event" });
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ eventId }) });
    expect(response.status).toBe(403);
    expect(operationsAnalytics.execute).not.toHaveBeenCalled();
  });
});
