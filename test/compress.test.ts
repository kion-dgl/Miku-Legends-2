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

import { readFileSync } from "fs";
import { test, expect } from "bun:test";

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

const decompressPayload = (
  payload: Buffer,
  bitfield: boolean[],
  fullsize: number,
): Buffer => {
  const target = Buffer.alloc(fullsize);

  let outOfs = 0;
  let windowOfs = 0;
  let ofs = 0;

  for (let i = 0; i < bitfield.length; i++) {
    const bit = bitfield[i];
    if (outOfs === fullsize) {
      break;
    }

    const word = payload.readUInt16LE(ofs);
    ofs += 2;

    if (!bit) {
      target.writeUInt16LE(word, outOfs);
      outOfs += 2;
      continue;
    } else {
      // Bit is true
      if (word === 0xffff) {
        windowOfs += 0x2000;
      } else {
        const whence = (word >> 3) & 0x1fff;
        const copyFrom = windowOfs + whence;
        const copyLen = ((word & 0x07) + 2) * 2;
        for (let n = 0; n < copyLen; n++) {
          target[outOfs++] = target[copyFrom + n];
        }
      }
    }
  }

  return target;
};

const compressSegment = (segment: Buffer): [boolean[], Buffer] => {
  // Create a boolean array and out buffer
  const bucket: boolean[] = [];
  const compressed = Buffer.alloc(segment.length);

  // Number of min and max number of words to match
  const MAX_CAP = 9;
  const MIN_CAP = 2;

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

test("Can I compress and decompress some payload", () => {
  const decompressed = readFileSync("fixtures/face-texture.bin");

  // First we need to split the decompressed file into segments
  const segments = [
    decompressed.subarray(0x0000, 0x2000),
    decompressed.subarray(0x2000, 0x4000),
    decompressed.subarray(0x4000, 0x6000),
    decompressed.subarray(0x6000, 0x8000),
    decompressed.subarray(0x8000),
  ];

  const bits: boolean[] = [];
  const loads: Buffer[] = [];
  segments.forEach((segment, index) => {
    const [b, p] = compressSegment(segment);
    b.forEach((bit) => bits.push(bit));
    loads.push(p);
    const dsx = decompressPayload(p, b, segment.length);
    expect(dsx).toEqual(segment);
  });

  const bitfied = encodeBitfield(bits);
  const payload = Buffer.concat(loads);

  const dsx = decompressPayload(payload, bits, 0x8080);
  expect(dsx).toEqual(decompressed);
});
