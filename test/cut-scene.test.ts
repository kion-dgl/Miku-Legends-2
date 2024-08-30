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

const renderImage = (src: Buffer, outName: string) => {
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

  const { fullSize } = tim;

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
  const diff = ofs - 0x30;
  ofs = 0x800;

  // Read the image data
  const imageData: number[] = new Array();
  for (let i = 0; i < fullSize - diff; i++) {
    const byte = src.readUInt8(ofs);
    ofs++;
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
  writeFileSync(`fixtures/${outName}.png`, buffer);
  return palette[0];
};

const renderTexture = (src: Buffer, outName: string) => {
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
  const palette: Pixel[][] = new Array();
  for (let i = 0; i < paletteCount; i++) {
    palette[i] = new Array();
    for (let k = 0; k < colorCount; k++) {
      const word = target.readUInt16LE(ofs);
      ofs += 2;
      palette[i].push(wordToColor(word));
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
      const { r, g, b, a } = palette[0][colorIndex!];
      png.data[dst++] = r;
      png.data[dst++] = g;
      png.data[dst++] = b;
      png.data[dst++] = a;
    }
  }

  // Export file
  const buffer = PNG.sync.write(png);
  writeFileSync(`fixtures/${outName}.png`, buffer);
  return palette[0];
};

// The first thing we need to do is iterate through the files and export all of the textures
// once we've located the spectific megaman textures, then we will update the test to export
// the specific one and write a fixture for it

test("it should dump all of the textures, from the texture files", () => {
  const INPUT = [
    {
      name: "cut-ST1CT.BIN",
      offset: 0x02d000,
      compressed: true,
    },
    {
      name: "cut-ST1FT.BIN",
      offset: 0x053000,
      compressed: true,
    },
    {
      name: "cut-ST03T.BIN",
      offset: 0x046000,
      compressed: true,
    },
    {
      name: "cut-ST3A02.BIN",
      offset: 0x03d800,
      compressed: false,
    },
    {
      name: "cut-ST4B01.BIN",
      offset: 0x023000,
      compressed: false,
    },
    {
      name: "cut-ST4B01.BIN",
      offset: 0x027800,
      compressed: false,
    },
    {
      name: "cut-ST4BT.BIN",
      offset: 0x03e800,
      compressed: true,
    },
    {
      name: "cut-ST4CT.BIN",
      offset: 0x047800,
      compressed: true,
    },
    {
      name: "cut-ST5C01.BIN",
      offset: 0x014800,
      compressed: false,
    },
    {
      name: "cut-ST15T.BIN",
      offset: 0x03a800,
      compressed: true,
    },
    {
      name: "cut-ST17T.BIN",
      offset: 0x052000,
      compressed: true,
    },
    {
      name: "cut-ST1700.BIN",
      offset: 0x011000,
      compressed: false,
    },
    {
      name: "cut-ST1701.BIN",
      offset: 0x00e800,
      compressed: false,
    },
    {
      name: "cut-ST1702.BIN",
      offset: 0x00b000,
      compressed: false,
    },
    {
      name: "cut-ST25T.BIN",
      offset: 0x049000,
      compressed: true,
    },
    {
      name: "cut-ST27T.BIN",
      offset: 0x067000,
      compressed: true,
    },
    {
      name: "cut-ST28T.BIN",
      offset: 0x06d000,
      compressed: true,
    },
    {
      name: "cut-ST30T.BIN",
      offset: 0x04a000,
      compressed: true,
    },
    {
      name: "cut-ST3001T.BIN",
      offset: 0x04a000,
      compressed: true,
    },
    {
      name: "cut-ST39T.BIN",
      offset: 0x01e000,
      compressed: true,
    },
    {
      name: "cut-ST46T.BIN",
      offset: 0x032000,
      compressed: true,
    },
    {
      name: "cut-ST52T.BIN",
      offset: 0x030000,
      compressed: true,
    },
    {
      name: "cut-ST0305.BIN",
      offset: 0x041000,
      compressed: false,
    },
    {
      name: "cut-ST1802T.BIN",
      offset: 0x052800,
      compressed: true,
    },
    {
      name: "cut-ST1803.BIN",
      offset: 0x018000,
      compressed: false,
    },
    {
      name: "cut-ST2501.BIN",
      offset: 0x00a000,
      compressed: false,
    },
  ];

  let lastPalette: Pixel[] = [];
  INPUT.forEach(({ name, offset, compressed }, index) => {
    const file = readFileSync(`bin/${name}`);
    const src = file.subarray(offset);

    const filename = `${name}-${offset.toString(16).padStart(6, "0")}-true`;
    let p: Pixel[];
    if (compressed) {
      p = renderTexture(src, filename);
    } else {
      p = renderImage(src, filename);
    }

    if (index > 0) {
      expect(lastPalette[0]).toEqual(p[0]);
      expect(lastPalette[1]).toEqual(p[1]);
      expect(lastPalette[2]).toEqual(p[2]);
      expect(lastPalette[3]).toEqual(p[3]);
      expect(lastPalette[4]).toEqual(p[4]);
      // expect(lastPalette[5]).toEqual(p[5]);
      expect(lastPalette[6]).toEqual(p[6]);
      expect(lastPalette[7]).toEqual(p[7]);
      expect(lastPalette[8]).toEqual(p[8]);
      expect(lastPalette[9]).toEqual(p[9]);
      expect(lastPalette[10]).toEqual(p[10]);
      expect(lastPalette[11]).toEqual(p[11]);
      // expect(lastPalette[12]).toEqual(p[12]);
      // expect(lastPalette[13]).toEqual(p[13]);
      expect(lastPalette[14]).toEqual(p[14]);
      expect(lastPalette[15]).toEqual(p[15]);
    }
    lastPalette = p;
  });
});
