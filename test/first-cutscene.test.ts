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

test("it should decode cutscene face texture into a png", () => {
  const src = readFileSync("bin/ST3A02.BIN").subarray(0x35000);

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

  expect(tim.type).toEqual(2);
  expect(tim.fullSize).toEqual(0x87d0);
  expect(tim.colorCount).toEqual(64);
  expect(tim.paletteCount).toEqual(1);
  expect(tim.paletteX).toEqual(128);
  expect(tim.paletteY).toEqual(240);
  expect(tim.imageX).toEqual(384);
  expect(tim.imageY).toEqual(0);

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

  expect(tim.width).toEqual(256);
  expect(tim.height).toEqual(256);

  // Read Bitfield

  let ofs = 0x30;
  const { colorCount, paletteCount } = tim;
  const palette: Pixel[][] = new Array();
  for (let i = 0; i < paletteCount; i++) {
    palette[i] = new Array();
    for (let k = 0; k < colorCount; k++) {
      const word = src.readUInt16LE(ofs);
      ofs += 2;
      palette[i].push(wordToColor(word));
    }
  }

  ofs = 0x800;
  // Read the image data
  const imageData: number[] = new Array();
  for (let i = 0; i < 0x8000; i++) {
    const byte = src.readUInt8(ofs++);
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
      const { r, g, b, a } = palette[0][colorIndex!];
      png.data[dst++] = r;
      png.data[dst++] = g;
      png.data[dst++] = b;
      png.data[dst++] = a;
    }
  }

  // Export file
  const buffer = PNG.sync.write(png);
  writeFileSync("fixtures/0-face-st03a2.png", buffer);
});
