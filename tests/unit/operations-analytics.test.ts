import { describe, expect, it } from "vitest";
import {
  GetAnonymousOperationsAnalytics,
  OperationsAnalyticsError,
  type OperationsAnalyticsRepository,
  type OperationsAnalyticsScope,
  type RawOperationsAnalytics,
} from "@shime/operations-analytics";

const scope: OperationsAnalyticsScope = {
  tenantId: "tenant-a",
  eventId: "event-a",
  serviceType: "marriage",
};

function raw(overrides: Partial<RawOperationsAnalytics> = {}): RawOperationsAnalytics {
  return {
    eventName: "Event A",
    interaction: {
      cohortSize: 5,
      memoCount: 8,
      favoriteCount: 2,
      wantsToTalkMoreCount: 3,
      feelings: [
        { key: "relaxed", count: 3 },
        { key: "curious", count: 2 },
      ],
    },
    matchChat: {
      cohortSize: 6,
      roomCount: 3,
      openRoomCount: 3,
      blockedRoomCount: 0,
      messageCount: 12,
      reportCount: 1,
      reportsByStatus: [{ key: "open", count: 1 }],
    },
    ...overrides,
  };
}

class FakeRepository implements OperationsAnalyticsRepository {
  constructor(readonly result: RawOperationsAnalytics | null) {}
  receivedScope: OperationsAnalyticsScope | null = null;

  async load(receivedScope: OperationsAnalyticsScope) {
    this.receivedScope = receivedScope;
    return this.result;
  }
}

describe("anonymous operations analytics", () => {
  it("suppresses an entire section below the minimum cohort", async () => {
    const repository = new FakeRepository(
      raw({ interaction: { ...raw().interaction, cohortSize: 4, memoCount: 100 } }),
    );
    const result = await new GetAnonymousOperationsAnalytics(repository).execute(scope);
    expect(result.interaction).toMatchObject({ available: false, cohortSize: null, distribution: [] });
    expect(result.interaction.metrics.memoCount).toEqual({ value: null, suppressed: true });
  });

  it("shows zero and counts of three or more while suppressing one or two", async () => {
    const result = await new GetAnonymousOperationsAnalytics(new FakeRepository(raw())).execute(scope);
    expect(result.interaction.metrics.memoCount).toEqual({ value: null, suppressed: true });
    expect(result.interaction.metrics.favoriteCount).toEqual({ value: null, suppressed: true });
    expect(result.interaction.metrics.wantsToTalkMoreCount).toEqual({ value: 3, suppressed: false });
    expect(result.matchChat.metrics.blockedRoomCount).toEqual({ value: 0, suppressed: false });
    expect(result.matchChat.metrics.reportCount).toEqual({ value: null, suppressed: true });
    expect(result.interaction.distribution).toEqual([
      { key: "relaxed", count: { value: 3, suppressed: false } },
      { key: "curious", count: { value: null, suppressed: true } },
    ]);
  });

  it("never copies private or identifying repository fields into the response", async () => {
    const unsafe = raw() as RawOperationsAnalytics & Record<string, unknown>;
    unsafe.participantId = "participant-secret";
    unsafe.privateNoteText = "private memo";
    unsafe.encryptedBody = "ciphertext";
    unsafe.reportDetail = "private report detail";
    const result = await new GetAnonymousOperationsAnalytics(new FakeRepository(unsafe)).execute(scope);
    const json = JSON.stringify(result);
    expect(json).not.toContain("participant-secret");
    expect(json).not.toContain("private memo");
    expect(json).not.toContain("ciphertext");
    expect(json).not.toContain("private report detail");
  });

  it("binds repository reads to tenant, event, and service scope", async () => {
    const repository = new FakeRepository(raw());
    await new GetAnonymousOperationsAnalytics(repository).execute(scope);
    expect(repository.receivedScope).toEqual(scope);
  });

  it("fails without exposing data when the scoped event does not exist", async () => {
    await expect(new GetAnonymousOperationsAnalytics(new FakeRepository(null)).execute(scope)).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    } satisfies Partial<OperationsAnalyticsError>);
  });
});
