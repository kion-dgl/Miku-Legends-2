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

import { test, expect } from "bun:test";
import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";
import { encodeTexel } from "../src/EncodeTexture";

type Pixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const wordToColor = (word: number): Pixel => {
  const r = ((word >> 0x00) & 0x1f) << 3;
  const g = ((word >> 0x05) & 0x1f) << 3;
  const b = ((word >> 0x0a) & 0x1f) << 3;
  const a = word > 0 ? 255 : 0;
  return { r, g, b, a };
};

const renderImage = (
  src: Buffer,
  base: string,
  pos: number,
  palette: Pixel[],
) => {
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

  switch (tim.colorCount) {
    case 16:
      tim.width *= 4;
      break;
    case 256:
      tim.width *= 2;
      break;
    default:
      tim.paletteCount *= tim.colorCount / 16;
      tim.colorCount = 16;
      tim.width *= 4;
      break;
  }

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

  ofs = 0;
  const { colorCount, paletteCount } = tim;

  for (let i = 0; i < paletteCount; i++) {
    for (let k = 0; k < colorCount; k++) {
      ofs += 2;
    }
  }

  // Read the image data
  const imageData: number[] = new Array();
  for (ofs; ofs < target.length; ofs++) {
    const byte = target.readUInt8(ofs);
    if (colorCount === 256) {
      imageData.push(byte);
    } else {
      imageData.push(byte & 0xf);
      imageData.push(byte >> 4);
    }
  }

  const { width, height } = tim;
  const png = new PNG({ width, height });

  let index = 0;
  let dst = 0;
  for (let y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      const colorIndex = imageData[index++];
      const { r, g, b, a } = palette[colorIndex!];
      png.data[dst++] = r;
      png.data[dst++] = g;
      png.data[dst++] = b;
      png.data[dst++] = a;
    }
  }

  // Export file
  const buffer = PNG.sync.write(png);
  writeFileSync(`out/${base}_${pos.toString(16)}.png`, buffer);
};

test("it should search for textures in the yosyonke", () => {
  const src = readFileSync("bin/yosyonke-ST0AT.BIN");
  const pals: Pixel[][] = [
    [
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 16, g: 16, b: 16, a: 255 },
      { r: 32, g: 32, b: 32, a: 255 },
      { r: 48, g: 48, b: 48, a: 255 },
      { r: 64, g: 64, b: 64, a: 255 },
      { r: 72, g: 72, b: 72, a: 255 },
      { r: 90, g: 90, b: 90, a: 255 },
      { r: 110, g: 110, b: 110, a: 255 },
      { r: 120, g: 120, b: 120, a: 255 },
      { r: 130, g: 130, b: 130, a: 255 },
      { r: 140, g: 140, b: 140, a: 255 },
      { r: 150, g: 150, b: 150, a: 255 },
      { r: 160, g: 160, b: 160, a: 255 },
      { r: 190, g: 190, b: 190, a: 255 },
      { r: 210, g: 210, b: 210, a: 255 },
      { r: 220, g: 220, b: 220, a: 255 },
      { r: 255, g: 255, b: 255, a: 255 },
    ],
  ];

  for (let i = 0; i < src.length; i += 0x800) {
    const tim = {
      type: src.readUInt32LE(i + 0x00),
      fullSize: src.readUInt32LE(i + 0x04),
      paletteX: src.readUInt16LE(i + 0x0c),
      paletteY: src.readUInt16LE(i + 0x0e),
      colorCount: src.readUInt16LE(i + 0x10),
      paletteCount: src.readUInt16LE(i + 0x12),
      imageX: src.readUInt16LE(i + 0x14),
      imageY: src.readUInt16LE(i + 0x16),
      width: src.readUInt16LE(i + 0x18),
      height: src.readUInt16LE(i + 0x1a),
      bitfieldSize: src.readUInt16LE(i + 0x24),
      payloadSize: src.readUInt16LE(i + 0x26),
    };

    if (tim.type !== 2 && tim.type !== 3) {
      continue;
    }

    if (tim.width == 0 || tim.height == 0) {
      continue;
    }

    const img = src.subarray(i);
    renderImage(img, "nino", i, pals[0]);
  }
});

test("it should search for room203 palette", () => {
  const src = readFileSync("bin/nino-ST1BT.BIN");
  const img = src.subarray(0x4d800);

  for (let i = 0; i < src.length; i += 0x800) {
    const tim = {
      type: src.readUInt32LE(i + 0x00),
      fullSize: src.readUInt32LE(i + 0x04),
      paletteX: src.readUInt16LE(i + 0x0c),
      paletteY: src.readUInt16LE(i + 0x0e),
      colorCount: src.readUInt16LE(i + 0x10),
      paletteCount: src.readUInt16LE(i + 0x12),
      imageX: src.readUInt16LE(i + 0x14),
      imageY: src.readUInt16LE(i + 0x16),
      width: src.readUInt16LE(i + 0x18),
      height: src.readUInt16LE(i + 0x1a),
      bitfieldSize: src.readUInt16LE(i + 0x24),
      payloadSize: src.readUInt16LE(i + 0x26),
    };

    if (tim.type !== 2) {
      continue;
    }

    if (tim.paletteX === 0 && tim.paletteY === 0) {
      continue;
    }

    const pal: Pixel[] = [];
    for (let k = 0; k < 16; k++) {
      const word = src.readUInt16LE(i + 0x30 + k * 2);
      pal.push(wordToColor(word));
    }

    renderImage(img, "poster", i, pal);
  }
});

// test("it should search for roll palette", () => {
//   const src = readFileSync("out/flutter-ST05T.BIN");

//   const img = src.subarray(0x10000);

//   for (let i = 0; i < src.length; i += 0x800) {
//     const tim = {
//       type: src.readUInt32LE(i + 0x00),
//       fullSize: src.readUInt32LE(i + 0x04),
//       paletteX: src.readUInt16LE(i + 0x0c),
//       paletteY: src.readUInt16LE(i + 0x0e),
//       colorCount: src.readUInt16LE(i + 0x10),
//       paletteCount: src.readUInt16LE(i + 0x12),
//       imageX: src.readUInt16LE(i + 0x14),
//       imageY: src.readUInt16LE(i + 0x16),
//       width: src.readUInt16LE(i + 0x18),
//       height: src.readUInt16LE(i + 0x1a),
//       bitfieldSize: src.readUInt16LE(i + 0x24),
//       payloadSize: src.readUInt16LE(i + 0x26),
//     };

//     if (tim.type !== 2) {
//       continue;
//     }

//     if (tim.paletteX === 0 && tim.paletteY === 0) {
//       continue;
//     }

//     const pal: Pixel[] = [];
//     for (let k = 0; k < 16; k++) {
//       const word = src.readUInt16LE(i + 0x30 + k * 2);
//       pal.push(wordToColor(word));
//     }

//     renderImage(img, "roll", i, pal);
//   }
// });
