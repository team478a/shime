import { deflateSync } from "node:zlib";
import type { LineRichMenuImage, LineRichMenuImageRenderer } from "@shime/integrations";

const WIDTH = 2500 as const;
const HEIGHT = 843 as const;
const MAX_BYTES = 1_000_000;
const STRIDE = WIDTH * 3 + 1;
type Color = readonly [number, number, number];

const FONT: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
};

export class PngLineRichMenuImageRenderer implements LineRichMenuImageRenderer {
  async render(input: Parameters<LineRichMenuImageRenderer["render"]>[0]): Promise<LineRichMenuImage> {
    const background = parseColor(input.appearance.backgroundColor);
    const panel = parseColor(input.appearance.panelColor);
    const accent = parseColor(input.appearance.accentColor);
    const text = parseColor(input.appearance.textColor);
    const pixels = Buffer.alloc(STRIDE * HEIGHT);
    fill(pixels, background);
    rectangle(pixels, 36, 36, 2428, 771, panel);
    border(pixels, 36, 36, 2428, 771, 12, accent);
    drawTextCentered(pixels, input.appearance.title, fitScale(input.appearance.title, 40), 132, accent);
    drawTextCentered(pixels, input.appearance.headline, fitScale(input.appearance.headline, 34), 395, text);
    rectangle(pixels, 720, 620, 1060, 130, accent);
    drawTextCentered(pixels, input.appearance.buttonText, fitScale(input.appearance.buttonText, 18, 960), 622, panel);

    const png = encodePng(pixels);
    if (png.byteLength > MAX_BYTES) throw new Error("LINE_RICH_MENU_IMAGE_TOO_LARGE");
    return { bytes: new Uint8Array(png), mimeType: "image/png", width: WIDTH, height: HEIGHT };
  }
}

function parseColor(value: string): Color {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function fitScale(text: string, preferred: number, availableWidth = WIDTH - 200) {
  return Math.min(preferred, Math.max(1, Math.floor(availableWidth / Math.max(1, text.length * 6 - 1))));
}

function fill(pixels: Buffer, color: Color) {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) setPixel(pixels, x, y, color);
  }
}

function rectangle(pixels: Buffer, x: number, y: number, width: number, height: number, color: Color) {
  const endX = Math.min(WIDTH, x + width);
  const endY = Math.min(HEIGHT, y + height);
  for (let row = Math.max(0, y); row < endY; row += 1) {
    for (let column = Math.max(0, x); column < endX; column += 1) setPixel(pixels, column, row, color);
  }
}

function border(pixels: Buffer, x: number, y: number, width: number, height: number, thickness: number, color: Color) {
  rectangle(pixels, x, y, width, thickness, color);
  rectangle(pixels, x, y + height - thickness, width, thickness, color);
  rectangle(pixels, x, y, thickness, height, color);
  rectangle(pixels, x + width - thickness, y, thickness, height, color);
}

function drawTextCentered(pixels: Buffer, text: string, scale: number, y: number, color: Color) {
  const glyphWidth = 5 * scale;
  const spacing = scale;
  const totalWidth = text.length * glyphWidth + (text.length - 1) * spacing;
  let x = Math.floor((WIDTH - totalWidth) / 2);
  for (const character of text) {
    const glyph = FONT[character];
    if (glyph) drawGlyph(pixels, glyph, x, y, scale, color);
    x += glyphWidth + spacing;
  }
}

function drawGlyph(pixels: Buffer, glyph: readonly string[], x: number, y: number, scale: number, color: Color) {
  glyph.forEach((row, rowIndex) => {
    [...row].forEach((value, columnIndex) => {
      if (value === "1") rectangle(pixels, x + columnIndex * scale, y + rowIndex * scale, scale, scale, color);
    });
  });
}

function setPixel(pixels: Buffer, x: number, y: number, color: Color) {
  const offset = y * STRIDE + 1 + x * 3;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
}

function encodePng(pixels: Buffer) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  body.copy(output, 4);
  output.writeUInt32BE(crc32(body), output.length - 4);
  return output;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
