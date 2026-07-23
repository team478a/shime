import { describe, expect, it } from "vitest";
import { mergeEventSettings } from "../../apps/web/src/server/event-settings";

describe("event settings merge", () => {
  it("preserves settings that are not included in an update", () => {
    expect(
      mergeEventSettings(
        { cardSetCode: "cards-v1", retentionDays: 90 },
        {
          retentionDays: 120,
          cardSetCode: undefined,
        },
      ),
    ).toEqual({ cardSetCode: "cards-v1", retentionDays: 120 });
  });

  it("stores participant categories as event-scoped settings", () => {
    expect(
      mergeEventSettings(
        {},
        {
          participantCategories: [
            { code: "group_a", label: "A" },
            { code: "group_b", label: "B" },
          ],
        },
      ),
    ).toEqual({
      participantCategories: [
        { code: "group_a", label: "A" },
        { code: "group_b", label: "B" },
      ],
    });
  });
});
