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

const renderImage = (src: Buffer, pos: number, palette: Pixel[]) => {
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
  writeFileSync(`out/logos_${pos.toString(16)}.png`, buffer);
};

test("it should search for textures in the file", () => {
  const src = readFileSync("bin/GAME.BIN");
  const pals: Pixel[][] = [];

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

    const palette: Pixel[] = [];
    for (let k = 0; k < 16; k++) {
      const word = src.readUInt16LE(i + 0x30 + k * 2);
      palette.push(wordToColor(word));
    }
    console.log(pals.length.toString(16));
    console.log("Offset: 0x%s", i.toString(16));
    pals.push(palette);
  }

  const img = src.subarray(0x041800);
  pals.forEach((palette, index) => {
    renderImage(img, index, palette);
  });
});
