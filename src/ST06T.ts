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
import {
  encodeCutSceneTexture,
  compressNewTexture,
  encodeTexel,
} from "./EncodeTexture";
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

const decompress = (src: Buffer) => {
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

  return target;
};

const updateDashie = (bin: Buffer, pngPath: string) => {
  const pngData = readFileSync(pngPath);

  const imgOfs = 0x20800;
  const pal: number[] = [];

  const encodedLogo = encodeCutSceneTexture(pal, pngData);
  const mpTexture = decompress(Buffer.from(bin.subarray(imgOfs)));

  const includedPal = Buffer.from(mpTexture.subarray(0, 0x20));
  const encodedTexture = Buffer.from(mpTexture.subarray(0x20));

  // Update Palette
  const palOfs = 0x26000;
  const red = encodeTexel(255, 0, 0, 255);
  for (let i = 0; i < pal.length; i++) {
    bin.writeUInt16LE(pal[i], palOfs + 0x30 + i * 2);
    // bin.writeUInt16LE(red, palOfs + 0x30 + i * 2);
  }

  const ROW_LEN = 0x80;
  const X_START = 0;
  const Y_START = 88;
  let texOfs = ROW_LEN * Y_START; // + PAL_OFS;
  let logoOfs = 0;
  const HEIGHT = 40;
  const WIDTH = 64;
  for (let y = 0; y < HEIGHT; y++) {
    texOfs += X_START / 2;
    for (let x = 0; x < WIDTH / 2; x++) {
      encodedTexture[texOfs++] = encodedLogo[logoOfs++];
    }
    texOfs += (256 - X_START - WIDTH) / 2;
  }

  // console.log("Logo Pos: 0x%s", logoOfs.toString(16));

  const imageData: number[] = new Array();
  for (let ofs = 0; ofs < encodedTexture.length; ofs++) {
    const byte = encodedTexture.readUInt8(ofs);

    imageData.push(byte & 0xf);
    imageData.push(byte >> 4);
  }

  const [bodyBitField, compressedBody] = compressNewTexture(
    includedPal,
    encodedTexture,
    1,
  );
  const len = bodyBitField.length + compressedBody.length;

  for (let i = 0x20830; i < 0x24a00; i++) {
    bin[i] = 0;
  }

  let ofs = 0x20830;
  for (let i = 0; i < bodyBitField.length; i++) {
    bin[ofs++] = bodyBitField[i];
  }

  for (let i = 0; i < compressedBody.length; i++) {
    bin[ofs++] = compressedBody[i];
  }

  if (ofs <= 0x24800) {
    console.log("too short!!!");
    throw new Error("dashie painting too short");
  } else if (len > 0x25000) {
    console.log("too long");
    throw new Error("dashie painting too long");
  } else {
    console.log("yaya!!!");
  }

  console.log("End: 0x%s", ofs.toString(16));
  bin.writeInt16LE(bodyBitField.length, 0x20824);
};

const updateFlutterPaintings2 = (dashie: string) => {
  const bin = readFileSync("bin/flutter-ST06T.BIN");
  updateDashie(bin, dashie);
  writeFileSync("out/flutter-ST06T.BIN", bin);
};

export default updateFlutterPaintings2;
export { updateFlutterPaintings2 };
