import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logo = await fs.readFile(path.join(root, "resources/orbit/logo.svg"));
const mark = await fs.readFile(
  path.join(root, "src/renderer/src/assets/icons/orbit.svg"),
  "utf8"
);
await fs.writeFile(
  path.join(root, "src/big-picture/src/assets/orbit-icon.svg"),
  mark.replaceAll("currentColor", "#ECECF1")
);
const build = path.join(root, "build/orbit");
const resources = path.join(root, "resources/orbit");
await fs.mkdir(build, { recursive: true });
await fs.mkdir(resources, { recursive: true });

const png = (size) => sharp(logo).resize(size, size).png().toBuffer();
await fs.writeFile(path.join(build, "icon.png"), await png(512));
await fs.writeFile(path.join(resources, "icon.png"), await png(256));
await fs.writeFile(
  path.join(build, "icon.ico"),
  await pngToIco(await Promise.all([16, 24, 32, 48, 64, 128, 256].map(png)))
);

// ICNS chunks contain PNG images; keep every platform asset reproducible on Windows.
const chunks = await Promise.all(
  [
    ["icp4", 16],
    ["icp5", 32],
    ["icp6", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
  ].map(async ([type, size]) => {
    const data = await png(size);
    const header = Buffer.alloc(8);
    header.write(type, 0, "ascii");
    header.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([header, data]);
  })
);
const icnsHeader = Buffer.alloc(8);
icnsHeader.write("icns", 0, "ascii");
icnsHeader.writeUInt32BE(
  8 + chunks.reduce((size, chunk) => size + chunk.length, 0),
  4
);
await fs.writeFile(
  path.join(build, "icon.icns"),
  Buffer.concat([icnsHeader, ...chunks])
);

for (const [name, color] of [
  ["tray-icon.png", "#FFFFFF"],
  ["tray-icon-dark.png", "#101309"],
]) {
  await sharp(Buffer.from(mark.replaceAll("currentColor", color)))
    .resize(32, 32)
    .png()
    .toFile(path.join(resources, name));
}

const sidebarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314"><rect width="164" height="314" fill="#0B0C10"/><circle cx="160" cy="270" r="120" fill="#251940"/><circle cx="20" cy="310" r="95" fill="#3E2573"/><image href="data:image/svg+xml;base64,${logo.toString("base64")}" x="42" y="60" width="80" height="80"/><text x="82" y="174" fill="#ECECF1" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="26">Orbit</text></svg>`;
const { data, info } = await sharp(Buffer.from(sidebarSvg))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const stride = Math.ceil((info.width * 3) / 4) * 4;
const bmp = Buffer.alloc(54 + stride * info.height);
bmp.write("BM");
bmp.writeUInt32LE(bmp.length, 2);
bmp.writeUInt32LE(54, 10);
bmp.writeUInt32LE(40, 14);
bmp.writeInt32LE(info.width, 18);
bmp.writeInt32LE(info.height, 22);
bmp.writeUInt16LE(1, 26);
bmp.writeUInt16LE(24, 28);
bmp.writeUInt32LE(stride * info.height, 34);
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const source = (y * info.width + x) * 3;
    const target = 54 + (info.height - 1 - y) * stride + x * 3;
    bmp[target] = data[source + 2];
    bmp[target + 1] = data[source + 1];
    bmp[target + 2] = data[source];
  }
}
await fs.writeFile(path.join(build, "installerSidebar.bmp"), bmp);
console.log("Orbit assets generated. Original Hydra assets have been kept.");
