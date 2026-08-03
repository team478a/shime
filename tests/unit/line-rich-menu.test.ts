import { describe, expect, it, vi } from "vitest";
import {
  HttpLineRichMenuProvider,
  type LineRichMenuImageRenderer,
  type LineRichMenuProvider,
  type LineRichMenuRepository,
  PublishLineRichMenu,
  PublishLineRichMenuError,
} from "@shime/integrations";
import { PngLineRichMenuImageRenderer } from "../../apps/web/src/server/line-rich-menu-image";

const tenantId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";
const actorUserId = "00000000-0000-4000-8000-000000000003";

function fixtures() {
  const calls: string[] = [];
  const repository: LineRichMenuRepository = {
    listEvents: vi.fn(async () => []),
    findEvent: vi.fn(async (scopedTenantId, scopedEventId) => {
      if (scopedTenantId !== tenantId || scopedEventId !== eventId) return null;
      return { id: eventId, name: "UATイベント", status: "published", startsAt: new Date("2026-08-05T01:00:00Z") };
    }),
    getLineSettings: vi.fn(async () => ({
      enabled: true,
      config: { channelId: "channel", liffId: "1234567890-abcdefgh", richMenu: { current: null, history: [] } },
    })),
    saveDeployment: vi.fn(async () => {
      calls.push("save");
    }),
  };
  const provider: LineRichMenuProvider = {
    getDefault: vi.fn(async () => ({ source: "messaging_api" as const, richMenuId: "richmenu-old" })),
    validate: vi.fn(async () => {
      calls.push("validate");
    }),
    create: vi.fn(async () => {
      calls.push("create");
      return "richmenu-new";
    }),
    uploadImage: vi.fn(async () => {
      calls.push("upload");
    }),
    setDefault: vi.fn(async (id) => {
      calls.push(`default:${id}`);
    }),
    clearDefault: vi.fn(async () => {
      calls.push("clear");
    }),
    delete: vi.fn(async (id) => {
      calls.push(`delete:${id}`);
    }),
  };
  const imageRenderer: LineRichMenuImageRenderer = {
    render: vi.fn(async () => ({
      bytes: new Uint8Array([1]),
      mimeType: "image/png" as const,
      width: 2500 as const,
      height: 843 as const,
    })),
  };
  const useCase = new PublishLineRichMenu(
    repository,
    { get: vi.fn(async () => provider) },
    imageRenderer,
    () => new Date("2026-08-03T08:00:00Z"),
  );
  return { calls, imageRenderer, repository, provider, useCase };
}

describe("LINE rich-menu publication", () => {
  it("publishes in the required order and records the scoped event deployment", async () => {
    const { calls, repository, useCase } = fixtures();
    const result = await useCase.execute({ tenantId, eventId, actorUserId, requestId: "request-1" });

    expect(calls).toEqual(["validate", "create", "upload", "default:richmenu-new", "save"]);
    expect(result.eventId).toBe(eventId);
    expect(result.eventEntryUrl).toContain(`eventId=${eventId}`);
    expect(repository.saveDeployment).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, actorUserId, requestId: "request-1" }),
    );
  });

  it("rejects an event outside the tenant before contacting LINE", async () => {
    const { provider, useCase } = fixtures();
    await expect(
      useCase.execute({
        tenantId: "00000000-0000-4000-8000-000000000099",
        eventId,
        actorUserId,
        requestId: "request-2",
      }),
    ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" } satisfies Partial<PublishLineRichMenuError>);
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("reports image generation failure before contacting LINE", async () => {
    const { imageRenderer, provider, useCase } = fixtures();
    vi.mocked(imageRenderer.render).mockRejectedValueOnce(new Error("render failed"));

    await expect(useCase.execute({ tenantId, eventId, actorUserId, requestId: "request-image" })).rejects.toMatchObject(
      { code: "LINE_RICH_MENU_IMAGE_FAILED" },
    );
    expect(provider.getDefault).not.toHaveBeenCalled();
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("deletes an incomplete new menu without changing the existing default", async () => {
    const { calls, provider, useCase } = fixtures();
    vi.mocked(provider.uploadImage).mockRejectedValueOnce(new Error("upload failed"));

    await expect(useCase.execute({ tenantId, eventId, actorUserId, requestId: "request-3" })).rejects.toMatchObject({
      code: "LINE_RICH_MENU_SAVE_FAILED",
    });
    expect(calls).toEqual(["validate", "create", "delete:richmenu-new"]);
    expect(provider.clearDefault).not.toHaveBeenCalled();
    expect(provider.setDefault).not.toHaveBeenCalled();
  });

  it("restores the previous default and deletes the new menu when recording fails", async () => {
    const { calls, repository, useCase } = fixtures();
    vi.mocked(repository.saveDeployment).mockRejectedValueOnce(new Error("database failed"));

    await expect(useCase.execute({ tenantId, eventId, actorUserId, requestId: "request-4" })).rejects.toMatchObject({
      code: "LINE_RICH_MENU_SAVE_FAILED",
    });
    expect(calls).toEqual([
      "validate",
      "create",
      "upload",
      "default:richmenu-new",
      "default:richmenu-old",
      "delete:richmenu-new",
    ]);
  });
});

describe("HTTP LINE rich-menu provider", () => {
  it("uses the API-data host for PNG upload and authenticates every request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const provider = new HttpLineRichMenuProvider("secret-token", fetcher);
    await provider.uploadImage("rich/menu id", {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      width: 2500,
      height: 843,
    });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api-data.line.me/v2/bot/richmenu/rich%2Fmenu%20id/content");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-token");
    expect(new Headers(init?.headers).get("content-type")).toBe("image/png");
  });
});

describe("LINE rich-menu image", () => {
  it("renders a valid LINE-compatible PNG below one megabyte", async () => {
    const image = await new PngLineRichMenuImageRenderer().render({ eventName: "UAT <確認> & test" });
    expect([...image.bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(readPngSize(image.bytes)).toEqual({ width: 2500, height: 843 });
    expect(image.bytes.byteLength).toBeLessThanOrEqual(1_000_000);
  });
});

function readPngSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
