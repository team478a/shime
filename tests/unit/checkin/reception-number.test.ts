import { describe, expect, it } from "vitest";

import {
  formatReceptionNumber,
  nextReceptionNumber,
  retainOrAllocateReceptionNumber,
} from "@shime/checkin/reception-number";

describe("reception number rules", () => {
  it("allocates one after the largest number without reusing gaps", () => {
    expect(nextReceptionNumber([1, 3])).toBe(4);
  });

  it("starts each empty category at one", () => {
    expect(nextReceptionNumber([])).toBe(1);
  });

  it("retains a cancelled participant's reception number on re-check-in", () => {
    expect(retainOrAllocateReceptionNumber(2, [1, 2, 3])).toBe(2);
  });

  it("formats the category label and sequence for staff", () => {
    expect(formatReceptionNumber("グループA", 12)).toBe("グループA12番");
    expect(formatReceptionNumber(null, null)).toBeNull();
  });
});
