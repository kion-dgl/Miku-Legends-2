/**

  Miku-Legends-2
  Copyright (C) 2024, DashGL Project
  By Kion (kion@dashgl.com)

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";

type Command = {
  ofs: number;
  cmd: number;
  byteLength: number;
  index: number;
  word: number;
};

const encodeTexel = (r: number, g: number, b: number, a: number) => {
  const rClr = Math.floor((r >> 3) & 0xff);
  const gClr = Math.floor((g >> 3) & 0xff);
  const bClr = Math.floor((b >> 3) & 0xff);
  const aClr = a === 0 ? 0 : 0x8000;
  const texel = rClr | (gClr << 5) | (bClr << 10) | aClr;
  return texel;
};

const readPixel = (data: Buffer, inOfs: number, pal: number[]) => {
  const a = data.readUInt8(inOfs + 3) === 0 ? 0 : 255;
  const r = a === 0 ? 0 : data.readUInt8(inOfs + 0);
  const g = a === 0 ? 0 : data.readUInt8(inOfs + 1);
  const b = a === 0 ? 0 : data.readUInt8(inOfs + 2);
  const texel = encodeTexel(r, g, b, a);

  // Search through the existing palette
  const index = pal.indexOf(texel);

  // If doesn't exist, we add it to the palette
  if (index === -1) {
    const pos = pal.length;
    pal.push(texel);
    return pos;
  }

  return index;
};

const encodePalette = (pngSrc: Buffer, palette: number[]) => {
  const pngInfo = PNG.sync.read(pngSrc);
  const { width, height, data } = pngInfo;

  // if (width !== 256 || height !== 256) {
  //   throw new Error("Encoder expects a 256x256 image");
  // }

  let inOfs = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      readPixel(data, inOfs, palette);
      inOfs += 4;
    }
  }

  return palette;
};

const encodeCutScenes = () => {
  const CUT_SCENES = [
    {
      name: "cut-ST1CT.BIN",
      offset: 0x02d000,
      compressed: true,
      png: "ST1CT-ST1C01.png",
      end: 0x2e1f2,
    },
    {
      name: "cut-ST1C01.BIN",
      offset: 0x014800,
      compressed: false,
      png: "ST1CT-ST1C01.png",
      end: -1,
    },
    {
      name: "cut-ST1FT.BIN",
      offset: 0x053000,
      compressed: true,
      png: "ST1FT.png",
      end: 0x054cac,
    },
    {
      name: "cut-ST03T.BIN",
      offset: 0x046000,
      compressed: true,
      png: "ST03T.png",
      end: 0x047f58,
    },
    {
      name: "cut-ST3A02.BIN",
      offset: 0x03d800,
      compressed: false,
      png: "ST3A02.png",
      end: -1,
    },
    {
      name: "cut-ST4B01.BIN",
      offset: 0x023000,
      compressed: false,
      png: "ST4B01 (1).png",
      end: -1,
    },
    {
      name: "cut-ST4B01.BIN",
      offset: 0x027800,
      compressed: false,
      png: "ST4B01 (2).png",
      end: -1,
    },
    {
      name: "cut-ST4BT.BIN",
      offset: 0x03e800,
      compressed: true,
      png: "ST4BT.png",
      end: 0x03fa34,
    },
    {
      name: "cut-ST4CT.BIN",
      offset: 0x047800,
      compressed: true,
      png: "ST4CT.png",
      end: 0x0493a4,
    },
    {
      name: "cut-ST5C01.BIN",
      offset: 0x014800,
      compressed: false,
      png: "ST5C01.png",
      end: -1,
    },
    {
      name: "cut-ST15T.BIN",
      offset: 0x03a800,
      compressed: true,
      png: "ST15T.png",
      end: 0x03b888,
    },
    {
      name: "cut-ST17T.BIN",
      offset: 0x052000,
      compressed: true,
      png: "ST17T-ST1700-ST1701-ST1702.png",
      end: 0x005316c,
    },
    {
      name: "cut-ST1700.BIN",
      offset: 0x011000,
      compressed: false,
      png: "ST17T-ST1700-ST1701-ST1702.png",
      end: -1,
    },
    {
      name: "cut-ST1701.BIN",
      offset: 0x00e800,
      compressed: false,
      png: "ST17T-ST1700-ST1701-ST1702.png",
      end: -1,
    },
    {
      name: "cut-ST1702.BIN",
      offset: 0x00b000,
      compressed: false,
      png: "ST17T-ST1700-ST1701-ST1702.png",
      end: -1,
    },
    {
      name: "cut-ST25T.BIN",
      offset: 0x049000,
      compressed: true,
      png: "ST25T.png",
      end: 0x04b396,
    },
    {
      name: "cut-ST27T.BIN",
      offset: 0x067000,
      compressed: true,
      png: "ST27T.png",
      end: 0x0068f98,
    },
    {
      name: "cut-ST28T.BIN",
      offset: 0x06d000,
      compressed: true,
      png: "ST28T.png",
      end: 0x06ecd6,
    },
    {
      name: "cut-ST30T.BIN",
      offset: 0x04a000,
      compressed: true,
      png: "ST30T-ST3001T-ST31T.png",
      end: 0x04c0d4,
    },
    {
      name: "cut-ST3001T.BIN",
      offset: 0x04a000,
      compressed: true,
      png: "ST30T-ST3001T-ST31T.png",
      end: 0x04c0d4,
    },
    {
      name: "cut-ST31T.BIN",
      offset: 0x04d000,
      compressed: true,
      png: "ST30T-ST3001T-ST31T.png",
      end: 0x04f0d4,
    },
    {
      name: "cut-ST39T.BIN",
      offset: 0x01e000,
      compressed: true,
      png: "ST39T.png",
      end: 0x0202a2,
    },
    {
      name: "cut-ST46T.BIN",
      offset: 0x032000,
      compressed: true,
      png: "ST46T.png",
      end: 0x032f84,
    },
    {
      name: "cut-ST52T.BIN",
      offset: 0x030000,
      compressed: true,
      png: "ST52T.png",
      end: 0x031a9c,
    },
    {
      name: "cut-ST0305.BIN",
      offset: 0x041000,
      compressed: false,
      png: "ST0305.png",
      end: -1,
    },
    {
      name: "cut-ST1802T.BIN",
      offset: 0x052800,
      compressed: true,
      png: "ST1802T-ST1803.png",
      end: 0x05454e,
    },
    {
      name: "cut-ST1803.BIN",
      offset: 0x018000,
      compressed: false,
      png: "ST1802T-ST1803.png",
      end: -1,
    },
    {
      name: "cut-ST2501.BIN",
      offset: 0x00a000,
      compressed: false,
      png: "ST2501.png",
      end: -1,
    },
  ];

  const palette = [0];
  CUT_SCENES.forEach(({ png }) => {
    const buffer = readFileSync(`miku/faces/${png}`);

    encodePalette(buffer, palette);
  });

  if (palette.length > 16) {
    throw new Error("Too many colors for face texture");
  }

  CUT_SCENES.forEach(({ name, offset, compressed, png, end }) => {
    // Read the Source Image
    const src = readFileSync(`bin/${name}`);
    const image = readFileSync(`miku/faces/${png}`);
    // Encode the image into binary
    const texture = encodeCutSceneTexture(palette, image);

    const tim = {
      type: src.readUInt32LE(offset + 0x00),
      fullSize: src.readUInt32LE(offset + 0x04),
      paletteX: src.readUInt16LE(offset + 0x0c),
      paletteY: src.readUInt16LE(offset + 0x0e),
      colorCount: src.readUInt16LE(offset + 0x10),
      paletteCount: src.readUInt16LE(offset + 0x12),
      imageX: src.readUInt16LE(offset + 0x14),
      imageY: src.readUInt16LE(offset + 0x16),
      width: src.readUInt16LE(offset + 0x18),
      height: src.readUInt16LE(offset + 0x1a),
      bitfieldSize: src.readUInt16LE(offset + 0x24),
      payloadSize: src.readUInt16LE(offset + 0x26),
    };

    const COLOR_SIZE = 2; //bytes;
    const { colorCount, paletteCount } = tim;
    const pal = Buffer.alloc(colorCount * paletteCount * COLOR_SIZE);
    for (let i = 0; i < 16; i++) {
      pal.writeUInt16LE(palette[i] || 0x0000, i * 2);
    }

    let stop = false;
    if (!compressed) {
      // If not compressed, then we can just replace what's there
      console.log(`File: ${name}, Offset: 0x${offset.toString(16)}`);
      // throw new Error("You need to implement uncompressed fucktard");
      return;
    } else {
      // Otherwise we will need to compress and pray to god nothing breaks
      console.log(`File: ${name}, Offset: 0x${offset.toString(16)}`);

      const blocks = src.readUInt16LE(offset + 0x08);

      console.log("Colors: :0x%s", colorCount.toString(16));
      console.log("Palettes: %s", paletteCount);

      if (end === -1) {
        throw new Error("You need to implement compressed fucktard");
      }

      // Zero Out the Previous Data
      for (let i = offset + 0x30; i < end; i++) {
        src[i] = 0;
      }

      const [bodyBitField, compressedBody] = compressNewTexture(pal, texture);

      // Update the bitfield length in header
      src.writeInt16LE(bodyBitField.length, 0x24);

      let bodyOfs = offset + 0x30;

      // Write the bitfield
      for (let i = 0; i < bodyBitField.length; i++) {
        src[bodyOfs++] = bodyBitField[i];
      }

      // Write the compressed Texture
      for (let i = 0; i < compressedBody.length; i++) {
        src[bodyOfs++] = compressedBody[i];
      }

      const lower = Math.floor(end / 0x800) * 0x800;
      const upper = Math.ceil(end / 0x800) * 0x800;

      if (bodyOfs > lower && bodyOfs < upper) {
        console.log("Looks good");
      } else if (bodyOfs <= lower) {
        console.log("too short");
        stop = true;
      } else {
        console.log("too long");
        stop = true;
      }
    }

    writeFileSync(`out/${name}`, src);
    if (stop) {
      throw new Error("Look at exported file");
    }
  });
};

const encodeCutSceneTexture = (pal: number[], src: Buffer) => {
  const face = PNG.sync.read(src);
  const { data, width, height } = face;

  let inOfs = 0;
  let outOfs = 0;
  const img = Buffer.alloc(0x8000, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const lowByte = readPixel(data, inOfs, pal);
      inOfs += 4;
      const highByte = readPixel(data, inOfs, pal);
      inOfs += 4;
      const byte = ((highByte << 4) | lowByte) & 0xff;
      img[outOfs] = byte;
      outOfs++;
    }
  }

  return img;
};

const encodeFace = (
  faceSrc: Buffer,
  wpnSrc: Buffer,
  facePal: number[],
  wpnPal: number[],
) => {
  const faceData = PNG.sync.read(faceSrc).data;
  const wpnData = PNG.sync.read(wpnSrc).data;

  let inOfs = 0;
  let outOfs = 0;
  const img = Buffer.alloc(0x8000, 0);

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x += 2) {
      if (y < 52) {
        // If y is less than 52 read from the face
        const lowByte = readPixel(faceData, inOfs, facePal);
        inOfs += 4;
        const highByte = readPixel(faceData, inOfs, facePal);
        inOfs += 4;
        const byte = ((highByte << 4) | lowByte) & 0xff;
        img[outOfs] = byte;
        outOfs++;
      } else if (y < 103 && x < 193) {
        // otherwise for the second row, read from the face
        const lowByte = readPixel(faceData, inOfs, facePal);
        inOfs += 4;
        const highByte = readPixel(faceData, inOfs, facePal);
        inOfs += 4;
        const byte = ((highByte << 4) | lowByte) & 0xff;
        img[outOfs] = byte;
        outOfs++;
      } else {
        // Otherwise read from the weapon
        const lowByte = readPixel(wpnData, inOfs, wpnPal);
        inOfs += 4;
        const highByte = readPixel(wpnData, inOfs, wpnPal);
        inOfs += 4;
        const byte = ((highByte << 4) | lowByte) & 0xff;
        img[outOfs] = byte;
        outOfs++;
      }
    }
  }

  return img;
};

const encodeImage = (pngSrc: Buffer) => {
  const pngInfo = PNG.sync.read(pngSrc);
  const { width, height, data } = pngInfo;

  if (width !== 256 || height !== 256) {
    throw new Error("Encoder expects a 256x256 image");
  }

  let inOfs = 0;
  let outOfs = 0;
  const palette: number[] = [0];
  const pal = Buffer.alloc(0x80, 0);
  const img = Buffer.alloc(0x8000, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const lowByte = readPixel(data, inOfs, palette);
      inOfs += 4;
      const highByte = readPixel(data, inOfs, palette);
      inOfs += 4;
      const byte = ((highByte << 4) | lowByte) & 0xff;
      img[outOfs] = byte;
      outOfs++;
    }
  }

  outOfs = 0;
  for (let i = 0; i < 16; i++) {
    const texel = palette[i] || 0x0000;
    pal.writeUInt16LE(texel, outOfs);
    outOfs += 2;
  }

  return [pal, img];
};

const compressSegment = (
  segment: Buffer,
  max: number,
  min: number,
): [boolean[], Buffer] => {
  // Create a boolean array and out buffer
  const bucket: boolean[] = [];
  const compressed = Buffer.alloc(segment.length);

  // Number of min and max number of words to match
  const MAX_CAP = max;
  const MIN_CAP = min;

  let inOfs = 0;
  let outOfs = 0;

  do {
    // Check ahead
    let found = false;
    const wordsLeft = (segment.length - inOfs) / 2;
    const maxCount = wordsLeft < MAX_CAP ? wordsLeft : MAX_CAP;

    // Check ahead

    for (let count = maxCount; count >= MIN_CAP; count--) {
      const len = count * 2;
      const needle = segment.subarray(inOfs, inOfs + len);
      const window = segment.subarray(0, inOfs);
      const needleOfs = window.indexOf(needle);

      if (needleOfs === -1) {
        continue;
      }

      found = true;
      const lowBits = count - 2;
      const highBits = needleOfs << 3;
      const word = highBits | lowBits;
      compressed.writeUInt16LE(word, outOfs);
      bucket.push(true);
      outOfs += 2;
      inOfs += len;
      break;
    }

    if (!found) {
      const word = segment.readUInt16LE(inOfs);
      inOfs += 2;
      bucket.push(false);
      compressed.writeUInt16LE(word, outOfs);
      outOfs += 2;
    }
  } while (inOfs < segment.length);

  // Write a true bit and 0xffff to finish the segment
  bucket.push(true);
  compressed.writeUInt16LE(0xffff, outOfs);
  outOfs += 2;

  const payload = compressed.subarray(0, outOfs);
  return [bucket, payload];
};

const encodeBitfield = (bits: boolean[]): Buffer => {
  const length = Math.ceil(bits.length / 32) * 4;
  let ofs = 0;
  const buffer = Buffer.alloc(length);
  const dword = new Uint32Array(1);

  for (let i = 0; i < bits.length; i += 32) {
    dword[0] = 0;
    bits[i + 0] && (dword[0] |= 0x80000000);
    bits[i + 1] && (dword[0] |= 0x40000000);
    bits[i + 2] && (dword[0] |= 0x20000000);
    bits[i + 3] && (dword[0] |= 0x10000000);

    bits[i + 4] && (dword[0] |= 0x8000000);
    bits[i + 5] && (dword[0] |= 0x4000000);
    bits[i + 6] && (dword[0] |= 0x2000000);
    bits[i + 7] && (dword[0] |= 0x1000000);

    bits[i + 8] && (dword[0] |= 0x800000);
    bits[i + 9] && (dword[0] |= 0x400000);
    bits[i + 10] && (dword[0] |= 0x200000);
    bits[i + 11] && (dword[0] |= 0x100000);

    bits[i + 12] && (dword[0] |= 0x80000);
    bits[i + 13] && (dword[0] |= 0x40000);
    bits[i + 14] && (dword[0] |= 0x20000);
    bits[i + 15] && (dword[0] |= 0x10000);

    bits[i + 16] && (dword[0] |= 0x8000);
    bits[i + 17] && (dword[0] |= 0x4000);
    bits[i + 18] && (dword[0] |= 0x2000);
    bits[i + 19] && (dword[0] |= 0x1000);

    bits[i + 20] && (dword[0] |= 0x800);
    bits[i + 21] && (dword[0] |= 0x400);
    bits[i + 22] && (dword[0] |= 0x200);
    bits[i + 23] && (dword[0] |= 0x100);

    bits[i + 24] && (dword[0] |= 0x80);
    bits[i + 25] && (dword[0] |= 0x40);
    bits[i + 26] && (dword[0] |= 0x20);
    bits[i + 27] && (dword[0] |= 0x10);

    bits[i + 28] && (dword[0] |= 0x8);
    bits[i + 29] && (dword[0] |= 0x4);
    bits[i + 30] && (dword[0] |= 0x2);
    bits[i + 31] && (dword[0] |= 0x1);

    buffer.writeUInt32LE(dword[0], ofs);
    ofs += 4;
  }

  return buffer;
};

const compressNewSegment = (inBuffer: Buffer) => {
  const crossedOut: number[] = [];
  const commands: Command[] = [];
  // Loop through the list of possible commands
  for (let cmd = 7; cmd >= 0; cmd--) {
    const byteLength = (cmd + 2) * 2;
    for (let ofs = 0; ofs < inBuffer.length; ofs += 2) {
      // Check if the offset has already been found

      let isCrossedOut = false;
      const start = ofs;
      const end = ofs + byteLength;

      for (let k = start; k < end; k += 2) {
        if (crossedOut.includes(k)) {
          isCrossedOut = true;
        }
      }

      if (isCrossedOut) {
        continue;
      }

      const needle = inBuffer.subarray(start, end);
      // Check for buffer passed the length
      if (ofs + byteLength > inBuffer.length || ofs < byteLength) {
        continue;
      }

      const haystack = inBuffer.subarray(0, ofs);
      // Check if the needle is in the haystack
      const index = haystack.indexOf(needle);
      if (index === -1) {
        continue;
      }

      const word = (index << 3) | cmd;
      // If found, we add the indexes to be skipped
      for (let k = start; k < end; k += 2) {
        crossedOut.push(k);
      }
      crossedOut.sort();
      commands.push({ ofs, cmd, byteLength, index, word });
    }
  }

  for (let ofs = 0; ofs < inBuffer.length; ofs += 2) {
    // Check if the offset has already been found
    if (crossedOut.includes(ofs)) {
      continue;
    }
    const word = inBuffer.readUInt16LE(ofs);
    commands.push({ ofs, cmd: -1, byteLength: 2, index: -1, word });
  }

  commands.sort((a, b) => a.ofs - b.ofs);
  const bits: boolean[] = [];
  const outBuffer = Buffer.alloc(commands.length * 2 + 2);
  let outOfs = 0;
  let inOfs = 0;
  commands.forEach((command, i) => {
    const { ofs, cmd, byteLength, word } = command;

    if (inOfs !== ofs) {
      throw new Error("Invalid offfset!!!!! Got " + ofs + "Expected: " + inOfs);
    }
    inOfs += byteLength;

    if (i < 5) {
      console.log(command);
    }

    if (cmd === -1) {
      try {
        bits.push(false);
        outBuffer.writeUInt16LE(word, outOfs);
        outOfs += 2;
      } catch (err) {
        console.log(command);
        console.log(i, commands.length);
        throw err;
      }
    } else {
      bits.push(true);
      outBuffer.writeUInt16LE(word, outOfs);
      outOfs += 2;
    }
  });

  bits.push(true);
  outBuffer.writeUInt16LE(0xffff, outOfs);
  outOfs += 2;

  return { bits, outBuffer: Buffer.from(outBuffer.subarray(0, outOfs)) };
};

const compressNewTexture = (pal: Buffer, img: Buffer) => {
  const decompressed = Buffer.concat([pal, img]);

  const SEGMENT_LENGTH = 0x2000;
  const segmentCount = Math.ceil(decompressed.length / SEGMENT_LENGTH);
  const segments: Buffer[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(
      decompressed.subarray(i * SEGMENT_LENGTH, (i + 1) * SEGMENT_LENGTH),
    );
  }

  const bits: boolean[] = [];
  const loads: Buffer[] = [];
  segments.forEach((segment, index) => {
    const { bits, outBuffer } = compressNewSegment(segment);
    bits.forEach((bit) => bits.push(bit));
    loads.push(outBuffer);
  });

  const bitfied = encodeBitfield(bits);
  return [bitfied, Buffer.concat(loads)];
};

const compressTexture = (
  pal: Buffer,
  img: Buffer,
  max: number,
  min: number,
) => {
  const decompressed = Buffer.concat([pal, img]);

  const SEGMENT_LENGTH = 0x2000;
  const segmentCount = Math.ceil(decompressed.length / SEGMENT_LENGTH);
  const segments: Buffer[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(
      decompressed.subarray(i * SEGMENT_LENGTH, (i + 1) * SEGMENT_LENGTH),
    );
  }

  const bits: boolean[] = [];
  const loads: Buffer[] = [];
  segments.forEach((segment, index) => {
    const [b, p] = compressSegment(segment, max, min);
    b.forEach((bit) => bits.push(bit));
    loads.push(p);
  });

  const bitfied = encodeBitfield(bits);
  return [bitfied, Buffer.concat(loads)];
};

const replaceBodyTexture = (
  modded: Buffer,
  bodyBuffer: Buffer,
  pl00t2: Buffer,
  // st03a2: Buffer,
) => {
  // Replace Body
  const [bodyPal, bodyImg] = encodeImage(bodyBuffer);

  const ST03A2_PAL_OFS = 0x2c830;
  const ST03A2_IMG_OFS = 0x2d000;
  for (let i = 0; i < bodyPal.length; i++) {
    // st03a2[ST03A2_PAL_OFS + i] = bodyPal[i];
    pl00t2[0x30 + i] = bodyPal[i];
  }

  for (let i = 0; i < bodyImg.length; i++) {
    // st03a2[ST03A2_IMG_OFS + i] = bodyImg[i];
    pl00t2[0x800 + i] = bodyImg[i];
  }

  const [bodyBitField, compressedBody] = compressTexture(
    bodyPal,
    bodyImg,
    9,
    4,
  );

  // First we zero out the previous image
  for (let i = 0x30; i < 0x3000; i++) {
    modded[i] = 0;
  }

  // Update the bitfield length in header
  modded.writeInt16LE(bodyBitField.length, 0x24);

  let bodyOfs = 0x30;

  // Write the bitfield
  for (let i = 0; i < bodyBitField.length; i++) {
    modded[bodyOfs++] = bodyBitField[i];
  }

  // Write the compressed Texture
  for (let i = 0; i < compressedBody.length; i++) {
    modded[bodyOfs++] = compressedBody[i];
  }

  // Replace Body Alternate Palette
  const BODY_ALT_PAL_OFS = 0x3030;
  for (let i = 0; i < bodyPal.length; i++) {
    modded[BODY_ALT_PAL_OFS + i] = bodyPal[i];
  }
};

const replaceFaceTexture = (
  modded: Buffer,
  faceBuffer: Buffer,
  facePalette: number[],
  weaponBuffer: Buffer,
  weaponPalette: number[],
  pl00t2: Buffer,
  // st03a2: Buffer,
) => {
  // Encode the Face Image
  const faceImg = encodeFace(
    faceBuffer,
    weaponBuffer,
    facePalette,
    weaponPalette,
  );
  const facePal = Buffer.alloc(0x80);
  const wpnPal = Buffer.alloc(0x80);
  let outOfs = 0;
  for (let i = 0; i < 16; i++) {
    facePal.writeUInt16LE(facePalette[i] || 0x0000, outOfs);
    wpnPal.writeUInt16LE(weaponPalette[i] || 0x0000, outOfs);
    outOfs += 2;
  }

  // Special Weapons

  const crusher = readFileSync("./bin/wpn_PL00R02.BIN");
  const busterCannon = readFileSync("./bin/wpn_PL00R03.BIN");
  const hyperShell = readFileSync("./bin/wpn_PL00R04.BIN");
  const homingMissle = readFileSync("./bin/wpn_PL00R05.BIN");
  const groundCrawler = readFileSync("./bin/wpn_PL00R06.BIN");
  const vacuumArm = readFileSync("./bin/wpn_PL00R07.BIN");
  const reflectArm = readFileSync("./bin/wpn_PL00R08.BIN");
  const shieldArm = readFileSync("./bin/wpn_PL00R09.BIN");
  const bladeArm = readFileSync("./bin/wpn_PL00R0A.BIN");
  const shiningLaser = readFileSync("./bin/wpn_PL00R0B.BIN");
  const machineGun = readFileSync("./bin/wpn_PL00R0C.BIN");
  const spreadBuster = readFileSync("./bin/wpn_PL00R0D.BIN");
  const aqauBlaster = readFileSync("./bin/wpn_PL00R0E.BIN");
  const hunterSeeker = readFileSync("./bin/wpn_PL00R0F.BIN");
  const drillArm = readFileSync("./bin/wpn_PL00R10.BIN");

  // Update the palette in the
  for (let i = 0; i < facePal.length; i++) {
    // Face
    // st03a2[0x35030 + i] = facePal[i];
    pl00t2[0x9030 + i] = facePal[i];
    // Weapon
    crusher[0x4030 + i] = wpnPal[i];
    busterCannon[0x4030 + i] = wpnPal[i];
    hyperShell[0x3830 + i] = wpnPal[i];
    homingMissle[0x2830 + i] = wpnPal[i];
    groundCrawler[0x3030 + i] = wpnPal[i];
    vacuumArm[0x2830 + i] = wpnPal[i];
    reflectArm[0x3030 + i] = wpnPal[i];
    shieldArm[0x2830 + i] = wpnPal[i];
    bladeArm[0x3830 + i] = wpnPal[i];
    shiningLaser[0x3830 + i] = wpnPal[i];
    machineGun[0x4030 + i] = wpnPal[i];
    spreadBuster[0x3030 + i] = wpnPal[i];
    aqauBlaster[0x3830 + i] = wpnPal[i];
    hunterSeeker[0x3830 + i] = wpnPal[i];
    drillArm[0x2830 + i] = wpnPal[i];
  }

  writeFileSync("./out/PL00R02.BIN", crusher);
  writeFileSync("./out/PL00R03.BIN", busterCannon);
  writeFileSync("./out/PL00R04.BIN", hyperShell);
  writeFileSync("./out/PL00R05.BIN", homingMissle);
  writeFileSync("./out/PL00R06.BIN", groundCrawler);
  writeFileSync("./out/PL00R07.BIN", vacuumArm);
  writeFileSync("./out/PL00R08.BIN", reflectArm);
  writeFileSync("./out/PL00R09.BIN", shieldArm);
  writeFileSync("./out/PL00R0A.BIN", bladeArm);
  writeFileSync("./out/PL00R0B.BIN", shiningLaser);
  writeFileSync("./out/PL00R0C.BIN", machineGun);
  writeFileSync("./out/PL00R0D.BIN", spreadBuster);
  writeFileSync("./out/PL00R0E.BIN", aqauBlaster);
  writeFileSync("./out/PL00R0F.BIN", hunterSeeker);
  writeFileSync("./out/PL00R10.BIN", drillArm);

  for (let i = 0; i < faceImg.length; i++) {
    // st03a2[0x35800 + i] = faceImg[i];
    pl00t2[0x9800 + i] = faceImg[i];
  }

  // First we zero out the previous image
  for (let i = 0x3830; i < 0x6500; i++) {
    modded[i] = 0;
  }

  // Compress the face texture
  const [faceBitField, compressedFace] = compressTexture(
    facePal,
    faceImg,
    9,
    2,
  );

  // Update the bitfield length in header
  modded.writeInt16LE(faceBitField.length, 0x3824);

  let faceOfs = 0x3830;

  // Write the bitfield
  for (let i = 0; i < faceBitField.length; i++) {
    modded[faceOfs++] = faceBitField[i];
  }

  // Write the compressed Texture
  for (let i = 0; i < compressedFace.length; i++) {
    modded[faceOfs++] = compressedFace[i];
  }
};

const encodeTexture = (
  bodyTexture: string,
  faceTexture: string,
  specialWeaponTexture: string,
) => {
  // Encode the body and face texture to write to ROM
  const srcTexture = readFileSync("bin/PL00T.BIN");

  // Read the body Image
  const bodyBuffer = readFileSync(bodyTexture);

  // Read the face Image
  const faceBuffer = readFileSync(faceTexture);
  const weaponBuffer = readFileSync(specialWeaponTexture);

  const facePalette = [0]; // 2
  const weaponPalette = [0]; //3

  encodePalette(faceBuffer, facePalette);
  encodePalette(weaponBuffer, weaponPalette);

  if (facePalette.length > 16) {
    throw new Error("Too many colors for face texture");
  }

  if (weaponPalette.length > 16) {
    throw new Error("Too many colors for weapon texture");
  }

  // Files that need to be replaced with the uncompressed versions
  const pl00t2 = readFileSync("./bin/PL00T2.BIN");
  // const st03a2 = readFileSync("./bin/ST3A02.BIN");

  // Modify the Game Texture
  const modTexture = Buffer.from(srcTexture);
  replaceBodyTexture(
    modTexture,
    bodyBuffer,
    pl00t2,
    // st03a2
  );
  replaceFaceTexture(
    modTexture,
    faceBuffer,
    facePalette,
    weaponBuffer,
    weaponPalette,
    pl00t2,
    // st03a2,
  );

  // Write the updated game files
  writeFileSync("./out/PL00T.BIN", modTexture);
  writeFileSync("./out/PL00T2.BIN", pl00t2);
  // writeFileSync("./out/ST3A02.BIN", st03a2);
};

export {
  encodePalette,
  encodeTexture,
  encodeImage,
  encodeFace,
  encodeCutScenes,
};
