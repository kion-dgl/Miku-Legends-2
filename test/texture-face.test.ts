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
import { encodePalette, encodeTexture, encodeFace } from "../src/EncodeTexture";
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

test("it should decode face texture into a png", () => {
  const src = readFileSync("bin/PL00T.BIN").subarray(0x3800);

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
  console.log(fullSize.toString(16));

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
  const palette: Pixel[][] = new Array();
  for (let i = 0; i < paletteCount; i++) {
    palette[i] = new Array();
    for (let k = 0; k < colorCount; k++) {
      const word = target.readUInt16LE(ofs);
      ofs += 2;
      palette[i].push(wordToColor(word));
    }
  }

  writeFileSync("fixtures/face-texture.bin", target);

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
      const { r, g, b, a } = palette[0][colorIndex!];
      png.data[dst++] = r;
      png.data[dst++] = g;
      png.data[dst++] = b;
      png.data[dst++] = a;
    }
  }

  // Export file
  const buffer = PNG.sync.write(png);
  writeFileSync("fixtures/0-face.png", buffer);
});

test("it should write a sliced texture with face and weapons", () => {
  const faceTexture = "miku/face-1.png";
  const specialWeaponTexture = "miku/megaman_img_002.png";

  const faceBuffer = readFileSync(faceTexture);
  const weaponBuffer = readFileSync(specialWeaponTexture);

  const facePalette = [0]; // 2
  const weaponPalette = [0]; //3

  encodePalette(faceBuffer, facePalette);
  encodePalette(weaponBuffer, weaponPalette);

  expect(facePalette.length).toBeLessThan(17);
  expect(weaponPalette.length).toBeLessThan(17);

  const faceImg = encodeFace(
    faceBuffer,
    weaponBuffer,
    facePalette,
    weaponPalette,
  );
  console.log(faceImg);

  expect(faceImg.length).toEqual(0x8000);

  const imageData: number[] = new Array();
  for (let ofs = 0; ofs < faceImg.length; ofs++) {
    const byte = faceImg.readUint8(ofs);
    imageData.push(byte & 0xf);
    imageData.push(byte >> 4);
  }

  const width = 256;
  const height = 256;

  // Write with special weapon palette
  const png = new PNG({ width, height });
  const palette = weaponPalette.map((word) => wordToColor(word));
  console.log(palette);

  let index = 0;
  let dst = 0;
  for (let y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      const colorIndex = imageData[index++];
      const { r, g, b, a } = palette[colorIndex];
      png.data[dst++] = r;
      png.data[dst++] = g;
      png.data[dst++] = b;
      png.data[dst++] = a;
    }
  }

  console.log(png.data);

  // Export file
  const buffer = PNG.sync.write(png);
  writeFileSync("fixtures/0-weapons.png", buffer);
});
