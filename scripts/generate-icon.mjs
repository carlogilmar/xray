// Generates app-icon.png (1024×1024) with no dependencies — a teal "scope"
// mark on a dark background, evoking Xray's scanning/targeting idea.
// Feed it to `pnpm tauri icon app-icon.png` to produce all platform icons.
import zlib from "node:zlib";
import fs from "node:fs";

const S = 1024;
const C = S / 2;
const bg = [13, 17, 23, 255]; // #0d1117
const fg = [45, 212, 191, 255]; // #2dd4bf

const raw = Buffer.alloc(S * (1 + S * 4));
for (let y = 0; y < S; y++) {
  const rowStart = y * (1 + S * 4);
  raw[rowStart] = 0; // filter: none
  for (let x = 0; x < S; x++) {
    const dx = x - C;
    const dy = y - C;
    const d = Math.sqrt(dx * dx + dy * dy);
    let c = bg;
    // outer ring
    if (d < 380 && d > 312) c = fg;
    // crosshair
    else if ((Math.abs(dx) < 16 || Math.abs(dy) < 16) && d < 440) c = fg;
    // center dot
    else if (d < 64) c = fg;

    const o = rowStart + 1 + x * 4;
    raw[o] = c[0];
    raw[o + 1] = c[1];
    raw[o + 2] = c[2];
    raw[o + 3] = c[3];
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync("app-icon.png", png);
console.log("wrote app-icon.png (1024×1024)");
