import { describe, expect, it } from "vitest";
import {
  buildLinePublicUrls,
  parseLiffLinkQuery,
} from "../../apps/web/src/server/line-client-config";
import { buildLiffApplicationLink, buildLiffEventEntryLink } from "@shime/core";

describe("LINE public URLs", () => {
  it("builds current LIFF and webhook URLs without deprecated schemes", () => {
    expect(
      buildLinePublicUrls("123-test", "https://shime.example/", "shime tenant"),
    ).toEqual({
      liffUrl: "https://liff.line.me/123-test",
      endpointUrl: "https://shime.example/liff/link",
      webhookUrl: "https://shime.example/api/webhooks/line?tenant=shime%20tenant",
    });
  });

  it("does not expose incomplete URLs", () => {
    expect(buildLinePublicUrls("", undefined)).toEqual({
      liffUrl: null,
      endpointUrl: null,
      webhookUrl: null,
    });
  });
});

describe("LIFF link query parsing", () => {
  it("uses direct query parameters after the secondary redirect", () => {
    expect(
      parseLiffLinkQuery({ eventId: "event-1", linkToken: "token-1" }),
    ).toEqual({ eventId: "event-1", linkToken: "token-1" });
  });

  it("reads additional LIFF URL information from the primary redirect state", () => {
    expect(
      parseLiffLinkQuery({
        "liff.state": "?eventId=event-2&linkToken=token-2",
      }),
    ).toEqual({ eventId: "event-2", linkToken: "token-2" });
  });

  it("supports a path before the state query", () => {
    expect(
      parseLiffLinkQuery({
        "liff.state": "/link?eventId=event-3&linkToken=token-3",
      }),
    ).toEqual({ eventId: "event-3", linkToken: "token-3" });
  });
});

describe("LIFF application link", () => {
  it("encodes event and opaque link-token values", () => {
    expect(buildLiffApplicationLink("123-test", "event/1", "secret+token")).toBe("https://liff.line.me/123-test?eventId=event%2F1&linkToken=secret%2Btoken");
  });

  it("does not build an incomplete link", () => {
    expect(buildLiffApplicationLink("", "event-1", "token")).toBeNull();
  });

  it("builds a tokenless re-entry link for an already linked participant", () => {
    expect(buildLiffEventEntryLink("123-test", "event/1")).toBe("https://liff.line.me/123-test?eventId=event%2F1");
    expect(buildLiffEventEntryLink("", "event-1")).toBeNull();
  });
});
