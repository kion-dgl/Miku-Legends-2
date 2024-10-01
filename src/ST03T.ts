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
import {
  encodePalette,
  encodeCutSceneTexture,
  compressNewTexture,
  encodeTexel,
  readPixel,
} from "./EncodeTexture";

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

/**
 * Updates the face texture in the prodived archive
 * @param src Buffer of the bin file to be updated
 * @param png Buffer of the png file to be encoded and
 */
const updateFace = (src: Buffer, buffer: Buffer) => {
  const palette: number[] = [];
  encodePalette(buffer, palette);
  if (palette.length > 16) {
    throw new Error("Too many colors for face texture");
  }
  const offset = 0x46000;
  const end = 0x47f58;
  const texture = encodeCutSceneTexture(palette, buffer);
  const makeBad = 0;

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

  const { type, fullSize } = tim;
  const palSize = fullSize - texture.length;
  if (palSize < 0x20 || palSize > 0x80) {
    throw new Error("apron body Invalid pal size");
  }

  const pal = Buffer.alloc(palSize);
  for (let i = 0; i < 16; i++) {
    pal.writeUInt16LE(palette[i] || 0x0000, i * 2);
  }

  let stop = false;
  const blocks = src.readUInt16LE(offset + 0x08);

  // Zero Out the Previous Data
  for (let i = offset + 0x30; i < end; i++) {
    src[i] = 0;
  }

  const [bodyBitField, compressedBody] = compressNewTexture(
    pal,
    texture,
    makeBad,
  );

  // Update the bitfield length in header
  src.writeInt16LE(bodyBitField.length, offset + 0x24);
  console.log("BitField Size: 0x%s", bodyBitField.length.toString(16));

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
    console.log(`apron body too short`);
    stop = true;
  } else {
    console.log("too long");
    stop = true;
  }
};

const encodeEggTexture = (
  pal: number[],
  eggPal: number[],
  src: Buffer,
  eggImg: Buffer,
) => {
  const face = PNG.sync.read(src);
  const { data, width, height } = face;

  const eggy = PNG.sync.read(eggImg);
  const eggData = eggy.data;

  let inOfs = 0;
  let outOfs = 0;
  const img = Buffer.alloc((width * height) / 2, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const lowByte = readPixel(data, inOfs, pal);
      forceIndex(lowByte, eggData, inOfs, eggPal);
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

const forceIndex = (
  index: number,
  data: Buffer,
  inOfs: number,
  pal: number[],
) => {
  const a = data.readUInt8(inOfs + 3) === 0 ? 0 : 255;
  const r = a === 0 ? 0 : data.readUInt8(inOfs + 0);
  const g = a === 0 ? 0 : data.readUInt8(inOfs + 1);
  const b = a === 0 ? 0 : data.readUInt8(inOfs + 2);
  const texel = encodeTexel(r, g, b, a);

  // If the color is transparent, we ignore
  if (texel === 0) {
    return;
  }

  if (pal[index] === 0) {
    pal[index] = texel;
  }
};

/**
 * Updates the body texture in the prodived archive
 * @param src Buffer of the bin file to be updated
 * @param png Buffer of the png file to be encoded and
 */
const updateBody = (src: Buffer, buffer: Buffer) => {
  const palette: number[] = [];
  encodePalette(buffer, palette);
  if (palette.length > 16) {
    throw new Error("Too many colors for face texture");
  }

  const eggsData = readFileSync(`miku/apron/eggs.png`);
  const eggPal: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const offset = 0x043000;
  const end = 0x045260;
  // const texture = encodeCutSceneTexture(palette, buffer);
  const texture = encodeEggTexture(palette, eggPal, buffer, eggsData);
  const makeBad = 0;

  const green = encodeTexel(0, 255, 0, 255);

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

  const { type, fullSize } = tim;
  const palSize = fullSize - texture.length;
  if (palSize < 0x20 || palSize > 0x80) {
    throw new Error("apron body Invalid pal size");
  }

  const pal = Buffer.alloc(palSize);
  for (let i = 0; i < 16; i++) {
    pal.writeUInt16LE(palette[i] || 0x0000, i * 2);
  }

  const white = encodeTexel(230, 230, 230, 255);
  for (let i = 0; i < eggPal.length; i++) {
    if (eggPal[i] === 0) {
      eggPal[i] = white;
    }
  }
  for (let i = 0; i < 16; i++) {
    pal.writeUInt16LE(eggPal[i], 0x20 + i * 2);
    // pal.writeUInt16LE(green, 0x20 + i * 2);
  }

  palette[0] = encodeTexel(15, 15, 15, 255);
  palette[1] = encodeTexel(15, 15, 15, 255);
  // palette[2] = green;
  // palette[3] = green;
  for (let i = 0; i < 16; i++) {
    pal.writeUInt16LE(palette[i] || 0x0000, 0x40 + i * 2);
  }

  let stop = false;
  const blocks = src.readUInt16LE(offset + 0x08);

  // Zero Out the Previous Data
  for (let i = offset + 0x30; i < end; i++) {
    src[i] = 0;
  }

  const [bodyBitField, compressedBody] = compressNewTexture(
    pal,
    texture,
    makeBad,
  );

  // Update the bitfield length in header
  src.writeInt16LE(bodyBitField.length, offset + 0x24);
  console.log("BitField Size: 0x%s", bodyBitField.length.toString(16));

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
    console.log(`apron body too short`);
    stop = true;
  } else {
    console.log("too long");
    stop = true;
  }
};

/**
 * Takes a face texture and a body texture to replace in the opening cut scene
 * @param src Buffer of the bin file to be updated
 */
const updateEggs = (src: Buffer) => {
  const hits = [];

  for (let i = 0; i < src.length; i += 0x800) {
    const type = src.readUInt32LE(i);
    const colorCount = src.readUInt16LE(i + 0x10);
    const paletteCount = src.readUInt16LE(i + 0x12);
    if (type !== 2) {
      continue;
    }

    if (colorCount <= 0 || colorCount > 256) {
      continue;
    }

    console.log("Paltte found at: 0x%s", i.toString(16));
    hits.push(i);
  }

  const red = encodeTexel(255, 0, 0, 255);
  const green = encodeTexel(0, 255, 0, 255);
  const blue = encodeTexel(0, 0, 255, 255);
  const yellow = encodeTexel(255, 255, 0, 255);
  const cyan = encodeTexel(0, 255, 255, 255);

  // Fry Pan
  // let panOfs = 0x45830;
  // for (let i = 0; i < 16; i++) {
  //   src.writeUInt16LE(red, panOfs + i * 2);
  // }

  // Eggs
  let eggOfs = 0x48030;
  for (let i = 0; i < 16; i++) {
    src.writeUInt16LE(green, eggOfs + i * 2);
  }

  // const swap = [
  //   // Leaf
  //   {
  //     from: [0x63, 0xdb, 0xd7],
  //     to: [0xd8, 0xf8, 0x78],
  //   },
  //   {
  //     from: [0x4e, 0xcb, 0xcd],
  //     to: [0xb8, 0xe0, 0x38],
  //   },
  //   {
  //     from: [0x63, 0xdb, 0xd7],
  //     to: [0xd8, 0xf8, 0x78],
  //   },
  //   // Egg
  //   {
  //     from: [0xe0, 0xe3, 0xe4],
  //     to: [0xf8, 0xe8, 0xe0],
  //   },
  //   {
  //     from: [0xbf, 0xc4, 0xc5],
  //     to: [0xe0, 0xd0, 0xc8],
  //   },
  //   // Sausage
  //   {
  //     from: [0xfd, 0xcb, 0xb0],
  //     to: [0xd8, 0x78, 0x58],
  //   },
  //   {
  //     from: [0xff, 0xb1, 0x93],
  //     to: [0xb8, 0x50, 0x30],
  //   },
  //   {
  //     from: [0xeb, 0x88, 0x66],
  //     to: [0x68, 0x28, 0x18],
  //   },
  //   {
  //     from: [0xf7, 0x9f, 0x80],
  //     to: [0x90, 0x30, 0x10],
  //   },
  //   // Plate + shadow
  //   {
  //     from: [0xe0, 0xe3, 0xe4],
  //     to: [0xe0, 0xe0, 0xf0],
  //   },
  //   {
  //     from: [0x7e, 0x8c, 0x90],
  //     to: [0xa0, 0xa0, 0xa0],
  //   },
  // ];
  // const pal2 = [...palette];
  // swap.forEach(({ from, to }) => {
  //   const [fr, rg, rb] = from;
  //   const [tr, tg, tb] = to;
  //   const needle = encodeTexel(fr, rg, rb, 255);
  //   const replace = encodeTexel(tr, tg, tb, 255);
  //   const closest = pal2.reduce(function (prev, curr) {
  //     return Math.abs(curr - needle) < Math.abs(prev - needle) ? curr : prev;
  //   });
  //   const index = pal2.indexOf(closest);
  //   if (index === -1) {
  //     throw new Error("Unable to find " + JSON.stringify(from));
  //   }
  //   console.log("yay");
  //   pal2[index] = replace;
  // });
  // const eggFix = readFileSync("out/cut-ST03T.BIN");
  // for (let i = 0; i < 16; i++) {
  //   eggFix.writeUInt16LE(pal2[i] || 0x0000, i * 2 + 0x45830);
  // }
};

const updateDashie = (bin: Buffer, pngPath: string) => {
  const pngData = readFileSync(pngPath);

  const imgOfs = 0x2e000;
  const pal: number[] = [];

  const encodedLogo = encodeCutSceneTexture(pal, pngData);
  const mpTexture = decompress(Buffer.from(bin.subarray(imgOfs)));

  const includedPal = Buffer.from(mpTexture.subarray(0, 0x20));
  const encodedTexture = Buffer.from(mpTexture.subarray(0x20));

  // Update Palette
  const palOfs = 0x33800;
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

  for (let i = 0x2e030; i < 0x321b0; i++) {
    bin[i] = 0;
  }

  let ofs = 0x2e030;
  for (let i = 0; i < bodyBitField.length; i++) {
    bin[ofs++] = bodyBitField[i];
  }

  for (let i = 0; i < compressedBody.length; i++) {
    bin[ofs++] = compressedBody[i];
  }

  if (ofs <= 0x32000) {
    console.log("too short!!!");
    throw new Error("dashie painting too short");
  } else if (len > 0x32800) {
    console.log("too long");
    throw new Error("dashie painting too long");
  } else {
    console.log("yaya!!!");
  }

  console.log("End: 0x%s", ofs.toString(16));
  bin.writeInt16LE(bodyBitField.length, 0x2e024);
};

/**
 * Takes a face texture and a body texture to replace in the opening cut scene
 * @param bodyTexture relative path to png file for body texture
 * @param faceTexture relative path to png file for face texture
 * @param dashie relative path to png file for painting in flutter living room
 */
const updateST03T = (
  bodyTexture: string,
  faceTexture: string,
  dashie: string,
) => {
  // Read the input files
  const src = readFileSync("bin/cut-ST03T.BIN");
  const body = readFileSync(bodyTexture);
  const face = readFileSync(faceTexture);

  // Encode and update the archive
  updateBody(src, body);
  updateFace(src, face);
  // updateEggs(src);

  updateDashie(src, dashie);
  // Write the resulting Archive
  writeFileSync("out/cut-ST03T.BIN", src);
};

export default updateST03T;
export { updateST03T };
