import { describe, expect, it } from "vitest";
import { resolveLineCredentials } from "../../apps/web/src/server/line-provider";

describe("LINE credential resolution", () => {
  const environment = {
    LINE_CHANNEL_ID: "environment-channel",
    LINE_CHANNEL_ACCESS_TOKEN: "environment-access-token",
    LINE_CHANNEL_SECRET: "environment-secret",
  };

  it("uses tenant settings before environment fallbacks", () => {
    expect(
      resolveLineCredentials(
        { channelId: "tenant-channel" },
        {
          accessToken: "tenant-access-token-value",
          channelSecret: "tenant-secret-value",
        },
        environment,
      ),
    ).toEqual({
      channelId: "tenant-channel",
      channelAccessToken: "tenant-access-token-value",
      channelSecret: "tenant-secret-value",
    });
  });

  it("falls back to environment credentials for unset values", () => {
    expect(resolveLineCredentials(undefined, {}, environment)).toEqual({
      channelId: "environment-channel",
      channelAccessToken: "environment-access-token",
      channelSecret: "environment-secret",
    });
  });
});
