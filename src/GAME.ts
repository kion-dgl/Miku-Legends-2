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
  encodePalette,
  encodeCutSceneTexture,
  encodeTexel,
  compressNewSegment,
  encodeBitfield,
} from "./EncodeTexture";

const compressData = (decompressed: Buffer) => {
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
    const { bits, outBuffer } = compressNewSegment(segment, 0);
    bits.forEach((bit) => bucket.push(bit));
    loads.push(outBuffer);
  });

  const bitfied = encodeBitfield(bucket);
  return [bitfied, Buffer.concat(loads)];
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

const updateDemoLogo = (pngPath: string) => {
  const bin = readFileSync("bin/GAME.BIN");
  const png = readFileSync(pngPath);

  const red = encodeTexel(255, 0, 0, 255);

  // Encode Image
  const pal = encodePalette(png, []);
  const img = encodeCutSceneTexture(pal, png);

  // Update Palette
  const palOfs = 0x44800;
  for (let i = 0; i < pal.length; i++) {
    bin.writeUInt16LE(pal[i], palOfs + 0x30 + i * 2);
  }

  // Update Image
  const imgOfs = 0x041800;
  // First thing we want to do is get the decompressed texture
  const buffer = Buffer.from(bin.subarray(imgOfs));
  const decompressed = decompress(buffer);

  // Then we splice in our updated encoded texture
  const height = 128;
  const width = 256;
  let inOfs = 0;
  let outOfs = 0;
  for (let y = 0; y < height; y++) {
    for (var x = 0; x < width; x += 2) {
      if (y >= 64 && y < 104) {
        if (x >= 48 && x < 144) {
          decompressed[outOfs] = img[inOfs];
          inOfs++;
        }
      }
      outOfs++;
    }
  }

  // And then we compress and put it back in
  const [bodyBitField, compressedBody] = compressData(decompressed, 0);
  const len = bodyBitField.length + compressedBody.length;
  console.log("Segment 2: 0x%s", len.toString(16));

  for (let i = 0x41830; i < 0x432f2; i++) {
    bin[i] = 0;
  }

  let ofs = 0x41830;
  for (let i = 0; i < bodyBitField.length; i++) {
    bin[ofs++] = bodyBitField[i];
  }

  for (let i = 0; i < compressedBody.length; i++) {
    bin[ofs++] = compressedBody[i];
  }

  if (ofs <= 0x43000) {
    console.log("too short!!!");
  } else if (len > 0x43800) {
    console.log("too long");
  } else {
    console.log("yaya!!!");
  }

  console.log("End: 0x%s", ofs.toString(16));
  bin.writeInt16LE(bodyBitField.length, 0x41824);

  writeFileSync("out/GAME.BIN", bin);
};

export default updateDemoLogo;
export { updateDemoLogo };
