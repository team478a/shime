import { describe, expect, it } from "vitest";
import { authorizeEventTransition } from "@shime/core";

describe("event transitions", () => {
  it("allows the next forward state", () => {
    expect(() => authorizeEventTransition({ from: "draft", to: "accepting", role: "manager" })).not.toThrow();
  });
  it("rejects skipped states", () => {
    expect(() => authorizeEventTransition({ from: "draft", to: "checkin_open", role: "system_admin" })).toThrow(
      /one step/,
    );
  });
  it("requires manager and a reason for rollback", () => {
    expect(() =>
      authorizeEventTransition({ from: "in_progress", to: "checkin_open", role: "operator", reason: "mistake" }),
    ).toThrow();
    expect(() => authorizeEventTransition({ from: "in_progress", to: "checkin_open", role: "manager" })).toThrow(
      /reason/,
    );
    expect(() =>
      authorizeEventTransition({ from: "in_progress", to: "checkin_open", role: "manager", reason: "誤操作" }),
    ).not.toThrow();
  });
  it("protects result_confirmed", () => {
    expect(() => authorizeEventTransition({ from: "result_confirmed", to: "completed", role: "manager" })).toThrow(
      /system_admin/,
    );
  });
});
