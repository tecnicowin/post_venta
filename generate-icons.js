const fs = require('fs');
const path = require('path');

function createPNG(size) {
  const canvas = size;
  const r = 37, g = 99, b = 235;

  const pixels = [];
  for (let y = 0; y < canvas; y++) {
    pixels.push(0); // filter byte
    for (let x = 0; x < canvas; x++) {
      const cx = canvas / 2, cy = canvas / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const radius = canvas * 0.45;

      if (dist <= radius) {
        // White letter area
        const lx = (x - cx) / radius;
        const ly = (y - cy) / radius;

        // Draw "PdV" text shape - simplified checkmark
        let isLetter = false;

        // P - left vertical bar
        if (lx >= -0.42 && lx <= -0.32 && ly >= -0.3 && ly <= 0.3) isLetter = true;
        // P - top horizontal bar
        if (lx >= -0.42 && lx <= -0.1 && ly >= -0.3 && ly <= -0.2) isLetter = true;
        // P - right curve top
        if (lx >= -0.1 && lx <= 0.0 && ly >= -0.3 && ly <= -0.15) isLetter = true;
        // P - middle horizontal bar
        if (lx >= -0.42 && lx <= 0.0 && ly >= -0.05 && ly <= 0.05) isLetter = true;

        // d - left vertical bar
        if (lx >= 0.08 && lx <= 0.18 && ly >= -0.3 && ly <= 0.3) isLetter = true;
        // d - right vertical bar
        if (lx >= 0.28 && lx <= 0.38 && ly >= -0.1 && ly <= 0.3) isLetter = true;
        // d - bottom curve
        if (lx >= 0.18 && lx <= 0.28 && ly >= 0.2 && ly <= 0.3) isLetter = true;
        // d - top horizontal
        if (lx >= 0.08 && lx <= 0.38 && ly >= -0.1 && ly <= 0.0) isLetter = true;

        // V shape
        const vx1 = -0.42, vy1 = 0.35;
        const vx2 = -0.25, vy2 = 0.55;
        const vx3 = -0.08, vy3 = 0.35;
        const vLineW = 0.08;

        if (isLetter) {
          pixels.push(255, 255, 255, 255); // white text
        } else {
          pixels.push(r, g, b, 255); // blue background
        }
      } else if (dist <= radius + 2) {
        pixels.push(r, g, b, 200); // slight edge
      } else {
        pixels.push(0, 0, 0, 0); // transparent
      }
    }
  }

  return encodePNG(canvas, canvas, pixels);
}

function encodePNG(width, height, pixels) {
  const raw = Buffer.from(pixels);

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crcBuf]);
  }

  // zlib compress (store mode - no compression)
  const compressed = deflateStore(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function deflateStore(data) {
  // Zlib wrapper around raw deflate store
  const cmf = 0x78; // CM=8 (deflate), CINFO=7 (32K window)
  const flg = 0x01; // FCHECK=1, FDICT=0, FLEVEL=0

  // Split into blocks of max 65535
  const blocks = [];
  let offset = 0;
  while (offset < data.length) {
    const blockLen = Math.min(65535, data.length - offset);
    const isLast = (offset + blockLen >= data.length) ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = isLast;
    header.writeUInt16LE(blockLen, 1);
    header.writeUInt16LE(blockLen ^ 0xffff, 3);
    blocks.push(header);
    blocks.push(data.slice(offset, offset + blockLen));
    offset += blockLen;
  }

  const deflated = Buffer.concat(blocks);
  const adler = adler32(data);

  const result = Buffer.alloc(2 + deflated.length + 4);
  result[0] = cmf;
  result[1] = flg;
  deflated.copy(result, 2);
  result.writeUInt32BE(adler, 2 + deflated.length);

  return result;
}

function adler32(data) {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// Generate icons
const dir = path.join(__dirname, 'assets', 'icons');
fs.mkdirSync(dir, { recursive: true });

const icon192 = createPNG(192);
fs.writeFileSync(path.join(dir, 'icon-192.png'), icon192);
console.log('Created icon-192.png (' + icon192.length + ' bytes)');

const icon512 = createPNG(512);
fs.writeFileSync(path.join(dir, 'icon-512.png'), icon512);
console.log('Created icon-512.png (' + icon512.length + ' bytes)');
