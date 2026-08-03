import sharp from "sharp";
import type { LineRichMenuImage, LineRichMenuImageRenderer } from "@shime/integrations";

const WIDTH = 2500 as const;
const HEIGHT = 843 as const;
const MAX_BYTES = 1_000_000;

export class SharpLineRichMenuImageRenderer implements LineRichMenuImageRenderer {
  async render(input: { eventName: string }): Promise<LineRichMenuImage> {
    const eventName = escapeXml(input.eventName).slice(0, 80);
    const svg = `
      <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <rect width="2500" height="843" fill="#fff8f7"/>
        <rect x="36" y="36" width="2428" height="771" rx="56" fill="#ffffff" stroke="#bf4c68" stroke-width="12"/>
        <text x="1250" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="86" font-weight="700" fill="#bf4c68">SHIME®</text>
        <text x="1250" y="410" text-anchor="middle" font-family="Arial, sans-serif" font-size="132" font-weight="700" fill="#2d2a2c">OPEN SHIME</text>
        <text x="1250" y="535" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" fill="#5d5558">${eventName}</text>
        <rect x="720" y="615" width="1060" height="116" rx="58" fill="#bf4c68"/>
        <text x="1250" y="693" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff">TAP TO OPEN</text>
      </svg>`;
    const output = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
    const metadata = await sharp(output).metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== WIDTH ||
      metadata.height !== HEIGHT ||
      output.length > MAX_BYTES
    ) {
      throw new Error("LINE_RICH_MENU_IMAGE_INVALID");
    }
    return { bytes: new Uint8Array(output), mimeType: "image/png", width: WIDTH, height: HEIGHT };
  }
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '\"': "&quot;",
    };
    return entities[character] ?? character;
  });
}
