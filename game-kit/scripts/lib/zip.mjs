// Minimal dependency-free zip writer (store only — models and npm tarballs are already compressed).
// Good for archives up to 4 GB / 65k files, which is plenty here.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const crc32 = zlib.crc32 ?? ((buf) => {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
});

/** All files under `dir` (recursive), as absolute paths. */
export async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}

/**
 * Write a zip file.
 * @param {string} zipPath
 * @param {{ name: string, file: string }[]} entries  name = path inside the zip (forward slashes)
 */
export async function writeZip(zipPath, entries) {
  const out = await fs.open(zipPath, 'w');
  const central = [];
  let offset = 0;
  for (const { name: n, file } of entries) {
    const name = Buffer.from(n);
    const data = await fs.readFile(file);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // utf-8 names
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    await out.write(Buffer.concat([local, name, data]));
    central.push(cen, name);
    offset += 30 + name.length + data.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  await out.write(Buffer.concat([cenBuf, end]));
  await out.close();
}
