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

const updateSmallLogo = (src: Buffer) => {
  const tim = {
    type: src.readUInt32LE(0x00),
    fullSize: src.readUInt32LE(0x04),
    paletteX: src.readUInt16LE(0x0c),
    paletteY: src.readUInt16LE(0x0e),
    colorCount: src.readUInt16LE(0x10),
    paletteCount: src.readUInt16LE(0x12),
    imageX: src.readUInt16LE(0x14),
    imageY: src.readUInt16LE(0x16),
    width: src.readUInt16LE(0x18),
    height: src.readUInt16LE(0x1a),
    bitfieldSize: src.readUInt16LE(0x24),
    payloadSize: src.readUInt16LE(0x26),
  };

  tim.width *= 4;

  const { fullSize, bitfieldSize } = tim;
  const bitfield: number[] = new Array();
  const target = Buffer.alloc(fullSize);

  // Read Bitfield
  const bitfieldBuffer = src.subarray(0x30, 0x30 + bitfieldSize);
  let ofs = 0x30;
  for (let i = 0; i < bitfieldSize; i += 4) {
    const dword = src.readUInt32LE(ofs + i);
    for (let k = 31; k > -1; k--) {
      bitfield.push(dword & (1 << k) ? 1 : 0);
    }
  }

  ofs += bitfieldSize;
  const payloadStart = 0;

  // Decompress

  let outOfs = 0;
  let windowOfs = 0;
  let cmdCount = 0;
  let bytes = 0;

  for (let i = 0; i < bitfield.length; i++) {
    const bit = bitfield[i];
    if (outOfs === fullSize) {
      const payload = src.subarray(0x30 + bitfieldSize, ofs);
      break;
    }

    const word = src.readUInt16LE(ofs);
    ofs += 2;

    switch (bit) {
      case 0:
        target.writeUInt16LE(word, outOfs);
        outOfs += 2;
        break;
      case 1:
        if (word === 0xffff) {
          windowOfs += 0x2000;
          cmdCount = 0;
          bytes = 0;
        } else {
          cmdCount++;
          const copyFrom = windowOfs + ((word >> 3) & 0x1fff);
          const copyLen = ((word & 0x07) + 2) * 2;
          bytes += copyLen;
          for (let i = 0; i < copyLen; i++) {
            target[outOfs++] = target[copyFrom + i];
          }
        }
        break;
    }
  }

  // Read the image data
  const imageData: number[] = new Array();
  for (ofs = 0; ofs < target.length; ofs++) {
    const byte = target.readUInt8(ofs);
    imageData.push(byte & 0xf);
    imageData.push(byte >> 4);
  }

  // Update title to debug palette
  const { width, height } = tim;
  let index = 0;
  for (let y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      if (x >= 48 && x < 48 + 96) {
        imageData[index] = Math.floor((x - 48) / 12);
        if (y >= 64 + 20 && y < 64 + 40) {
          imageData[index] += 8;
        }
      }
    }
  }

  // Re-encode the image data into a buffer
  ofs = 0;
  for (let i = 0; i < imageData.length; i += 2) {
    const a = imageData[i] & 0x0f;
    const b = imageData[i + 1] & 0x0f;
    const byte = a | (b << 4);
    target.writeUInt8(byte, ofs);
    ofs++;
  }

  return target;
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

const compressNewSegment = (inBuffer: Buffer, makeBad: number) => {
  const crossedOut: number[] = [];
  const commands: Command[] = [];

  const MAX_COMMAND = 7;
  const MIN_COMMAND = 0;
  let start = MAX_COMMAND;
  let end = MIN_COMMAND;
  let skip = 0;

  if (makeBad === 1) {
    start = 5;
    end = 0;
  } else if (makeBad === 2) {
    start = 5;
    end = 2;
  } else if (makeBad === 3) {
    start = 5;
    end = 2;
    skip = 280;
  } else if (makeBad === 4) {
    start = 2;
    end = 2;
    skip = 440;
  } else if (makeBad === 5) {
    start = 2;
    end = 2;
    skip = 800;
  }

  // Loop through the list of possible commands
  for (let cmd = start; cmd >= end; cmd--) {
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

      // Skip over stuff that might be found to make compression worse
      if (skip > 0) {
        skip--;
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

const compressNewTexture = (decompressed: Buffer, makeBad: number) => {
  const SEGMENT_LENGTH = 0x2000;
  const segmentCount = Math.ceil(decompressed.length / SEGMENT_LENGTH);
  const segments: Buffer[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(
      decompressed.subarray(i * SEGMENT_LENGTH, (i + 1) * SEGMENT_LENGTH),
    );
  }

  const bucket: boolean[] = [];
  const loads: Buffer[] = [];
  segments.forEach((segment, index) => {
    const { bits, outBuffer } = compressNewSegment(segment, makeBad);
    bits.forEach((bit) => bucket.push(bit));
    loads.push(outBuffer);
  });

  const bitfied = encodeBitfield(bucket);
  return [bitfied, Buffer.concat(loads)];
};

const encodeImage = (pngSrc: Buffer) => {
  const pngInfo = PNG.sync.read(pngSrc);
  const { width, height, data } = pngInfo;

  let inOfs = 0;
  let outOfs = 0;
  const palette: number[] = [];
  const pal = Buffer.alloc(0x200, 0);
  const img = Buffer.alloc(0x1fe00, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      img[outOfs] = readPixel(data, inOfs, palette);
      inOfs += 4;
      outOfs++;
    }
  }

  console.log("Palette");
  console.log(palette);

  outOfs = 0;
  for (let i = 0; i < 16; i++) {
    const texel = palette[i] || 0x0000;
    pal.writeUInt16LE(texel, outOfs);
    outOfs += 2;
  }

  return [pal, img];
};

const encodeTitle = (src: string) => {
  const PAL_SIZE = 0x200;
  const SEG_SIZE = 0x7f80;
  const IMG_SIZE = 0x1fe00;

  const buffer = readFileSync(src);
  const bin = readFileSync("bin/TITLE.BIN");
  const [pal, img] = encodeImage(buffer);

  console.log("--------- Title -------------");
  console.log(pal);
  console.log(img);

  const block = Buffer.from(img.subarray(SEG_SIZE * 0, SEG_SIZE * 1));
  const segment0 = Buffer.concat([pal, block]);
  const segment1 = Buffer.from(img.subarray(SEG_SIZE * 1, SEG_SIZE * 2));
  const segment2 = Buffer.from(img.subarray(SEG_SIZE * 2, SEG_SIZE * 3));
  const segment3 = Buffer.from(img.subarray(SEG_SIZE * 3, SEG_SIZE * 4));

  // Segment 0
  (() => {
    const [bodyBitField, compressedBody] = compressNewTexture(segment0, 3);
    const len = bodyBitField.length + compressedBody.length;
    console.log("Segment 0: 0x%s", len.toString(16));

    if (len <= 0x1800) {
      console.log("too short!!!");
    } else if (len > 0x2000) {
      console.log("too long");
    } else {
      console.log("yaya!!!");
    }

    for (let i = 0x5830; i < 0x7422; i++) {
      bin[i] = 0;
    }

    let ofs = 0x5830;
    for (let i = 0; i < bodyBitField.length; i++) {
      bin[ofs++] = bodyBitField[i];
    }

    for (let i = 0; i < compressedBody.length; i++) {
      bin[ofs++] = compressedBody[i];
    }

    bin.writeInt16LE(bodyBitField.length, 0x5824);
  })();

  // Segment 1
  (() => {
    const [bodyBitField, compressedBody] = compressNewTexture(segment1, 4);
    const len = bodyBitField.length + compressedBody.length;
    console.log("Segment 2: 0x%s", len.toString(16));

    if (len <= 0x3000) {
      console.log("too short!!!");
    } else if (len > 0x3800) {
      console.log("too long");
    } else {
      console.log("yaya!!!");
    }

    for (let i = 0x7830; i < 0xaab0; i++) {
      bin[i] = 0;
    }

    let ofs = 0x7830;
    for (let i = 0; i < bodyBitField.length; i++) {
      bin[ofs++] = bodyBitField[i];
    }

    for (let i = 0; i < compressedBody.length; i++) {
      bin[ofs++] = compressedBody[i];
    }

    console.log("End: 0x%s", ofs.toString(16));
    bin.writeInt16LE(bodyBitField.length, 0x7824);
  })();

  // Segment 2
  (() => {
    const [bodyBitField, compressedBody] = compressNewTexture(segment2, 5);
    const len = bodyBitField.length + compressedBody.length;
    console.log("Segment 3: 0x%s", len.toString(16));

    if (len <= 0x3800) {
      console.log("too short!!!");
    } else if (len > 0x4000) {
      console.log("too long");
    } else {
      console.log("yaya!!!");
    }

    for (let i = 0xb030; i < 0xeea6; i++) {
      bin[i] = 0;
    }

    let ofs = 0xb030;
    for (let i = 0; i < bodyBitField.length; i++) {
      bin[ofs++] = bodyBitField[i];
    }

    for (let i = 0; i < compressedBody.length; i++) {
      bin[ofs++] = compressedBody[i];
    }

    console.log("End: 0x%s", ofs.toString(16));
    bin.writeInt16LE(bodyBitField.length, 0xb024);
  })();

  // Segment 3
  (() => {
    const [bodyBitField, compressedBody] = compressNewTexture(segment3, 2);
    const len = bodyBitField.length + compressedBody.length;
    console.log("Segment 4: 0x%s", len.toString(16));

    if (len <= 0x1800) {
      console.log("too short!!!");
    } else if (len > 0x2000) {
      console.log("too long");
    } else {
      console.log("yaya!!!");
    }

    for (let i = 0xf030; i < 0x10cea; i++) {
      bin[i] = 0;
    }

    let ofs = 0xf030;
    for (let i = 0; i < bodyBitField.length; i++) {
      bin[ofs++] = bodyBitField[i];
    }

    for (let i = 0; i < compressedBody.length; i++) {
      bin[ofs++] = compressedBody[i];
    }

    console.log("End: 0x%s", ofs.toString(16));
    bin.writeInt16LE(bodyBitField.length, 0xf024);
  })();

  // Small logo debug
  (() => {
    const smallTex = Buffer.from(bin.subarray(0x20000));
    const update = updateSmallLogo(smallTex);

    const [bodyBitField, compressedBody] = compressNewTexture(update, 2);
    const len = bodyBitField.length + compressedBody.length;
    console.log("Smol logo: 0x%s", len.toString(16));

    if (len <= 0x1800) {
      console.log("too short!!!");
    } else if (len > 0x2000) {
      console.log("too long");
    } else {
      console.log("yaya!!!");
    }

    for (let i = 0x20030; i < 0x21af2; i++) {
      bin[i] = 0;
    }

    let ofs = 0x20030;
    for (let i = 0; i < bodyBitField.length; i++) {
      bin[ofs++] = bodyBitField[i];
    }

    for (let i = 0; i < compressedBody.length; i++) {
      bin[ofs++] = compressedBody[i];
    }

    console.log("End: 0x%s", ofs.toString(16));
    bin.writeInt16LE(bodyBitField.length, 0x20024);
  })();

  writeFileSync("out/TITLE.BIN", bin);
};

export { encodeTitle };
export default encodeTitle;
