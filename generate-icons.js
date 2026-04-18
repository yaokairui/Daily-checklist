const { createCanvas } = (() => {
  try { return require('canvas'); } catch(e) { return { createCanvas: null }; }
})();

function generateIconPng(size) {
  const headerSize = 8;
  const ihdrSize = 13;
  const idatMaxSize = size * size * 2 + size;
  const bufferSize = headerSize + ihdrSize + 12 + idatMaxSize + 12 + 12;
  const buf = Buffer.alloc(bufferSize);
  let offset = 0;

  function writeByte(b) { buf[offset++] = b & 0xff; }
  function writeUint32(v) { buf[offset++] = (v >> 24) & 0xff; buf[offset++] = (v >> 16) & 0xff; buf[offset++] = (v >> 8) & 0xff; buf[offset++] = v & 0xff; }

  function crc32(data) {
    let crc = 0xffffffff;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  writeUint32(0x89504e47);
  writeUint32(0x0d0a1a0a);

  const ihdrStart = offset;
  writeUint32(ihdrSize);
  const ihdrTypeStart = offset;
  writeByte(0x49); writeByte(0x48); writeByte(0x44); writeByte(0x52);
  writeUint32(size);
  writeUint32(size);
  writeByte(8); writeByte(6); writeByte(0); writeByte(0); writeByte(0);
  const ihdrCrc = crc32(buf.slice(ihdrTypeStart, offset));
  writeUint32(ihdrCrc);

  const rawPixels = [];
  const center = size / 2;
  const radius = size * 0.4;
  const cornerRadius = size * 0.18;

  for (let y = 0; y < size; y++) {
    rawPixels.push(0);
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let alpha = 0;
      let r = 94, g = 92, b = 230;

      if (dist <= radius - cornerRadius) {
        alpha = 255;
      } else if (dist <= radius) {
        const t = (dist - (radius - cornerRadius)) / cornerRadius;
        alpha = Math.round(255 * (1 - t * t));
      }

      const cx = x - center;
      const cy = y - center;
      const checkSize = size * 0.22;
      const isCheck = Math.abs(cy) < checkSize * 0.15 && cx > -checkSize * 0.5 && cx < checkSize * 0.5;
      const isCheckVert = Math.abs(cx + checkSize * 0.15) < checkSize * 0.15 && cy > -checkSize * 0.3 && cy < checkSize * 0.15;

      if (isCheck || isCheckVert) {
        r = 255; g = 255; b = 255;
        if (alpha > 0) alpha = 255;
      }

      rawPixels.push(r, g, b, alpha);
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawPixels));

  const idatStart = offset;
  writeUint32(compressed.length);
  const idatTypeStart = offset;
  writeByte(0x49); writeByte(0x44); writeByte(0x41); writeByte(0x54);
  for (let i = 0; i < compressed.length; i++) writeByte(compressed[i]);
  const idatCrc = crc32(buf.slice(idatTypeStart, offset));
  writeUint32(idatCrc);

  writeUint32(0);
  const iendTypeStart = offset;
  writeByte(0x49); writeByte(0x45); writeByte(0x4e); writeByte(0x44);
  writeUint32(crc32(buf.slice(iendTypeStart, offset)));

  return buf.slice(0, offset);
}

const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 64, 128, 256, 512];
const buildDir = path.join(__dirname, 'build');
const srcAssetsDir = path.join(__dirname, 'src', 'assets');

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
if (!fs.existsSync(srcAssetsDir)) fs.mkdirSync(srcAssetsDir, { recursive: true });

sizes.forEach(size => {
  const png = generateIconPng(size);
  fs.writeFileSync(path.join(buildDir, `icon_${size}.png`), png);
});

fs.writeFileSync(path.join(srcAssetsDir, 'icon.png'), generateIconPng(256));
fs.writeFileSync(path.join(srcAssetsDir, 'tray-icon.png'), generateIconPng(16));

console.log('Icons generated successfully!');
