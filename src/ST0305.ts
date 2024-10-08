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
import { encodeMeshWithMaterial } from "./EncodeModel";
import { PNG } from "pngjs";
import {
  encodePalette,
  encodeCutSceneTexture,
  compressNewTexture,
  encodeTexel,
  readPixel,
} from "./EncodeTexture";

type EntityHeader = {
  id: string;
  meshOfs: number;
  tracksOfs: number;
  controlOfs: number;
};

type HierarchyStruct = {
  polygonIndex: number;
  boneIndex: number;
  boneParent: number;
  hidePolygon: boolean;
  shareVertices: boolean;
};

type TextureCoords = {
  imageX: number;
  imageY: number;
  paletteX: number;
  paletteY: number;
};

type Range = { start: number; end: number };
type Alloc = { ranges: Range[]; contentEnd: number };

const CUT_SCENES = [
  {
    name: "cut-ST0305.BIN",
    offset: 0x041000,
    compressed: false,
    png: "ST0305.png",
    end: -1,
  },
];

const updateDashie = (bin: Buffer, pngPath: string) => {
  const pngData = readFileSync(pngPath);

  const imgOfs = 0x1a000;
  const pal: number[] = [];

  const encodedLogo = encodeCutSceneTexture(pal, pngData);
  const encodedTexture = Buffer.from(bin.subarray(0x1a800, 0x22800));

  // Update Palette
  const palOfs = 0x23800;
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

  let ofs = 0x1a800;
  for (let i = 0; i < encodedTexture.length; i++) {
    bin[ofs + i] = encodedTexture[i];
  }
};

const encodeCutScenes = () => {
  const palette: number[] = [];

  CUT_SCENES.forEach(({ png }) => {
    const buffer = readFileSync(`miku/faces/${png}`);
    encodePalette(buffer, palette);
  });

  if (palette.length > 16) {
    throw new Error("Too many colors for face texture");
  }

  const red = encodeTexel(255, 0, 0, 255);
  let ST4B01: Buffer = Buffer.alloc(0);
  CUT_SCENES.forEach(({ name, offset, compressed, png, end }) => {
    // Read the Source Image
    let src = readFileSync(`bin/${name}`);
    if (name === "cut-ST4B01.BIN" && ST4B01.length === 0) {
      ST4B01 = src;
    } else if (name === "cut-ST4B01.BIN" && ST4B01.length !== 0) {
      src = ST4B01;
    }

    const image = readFileSync(`miku/faces/${png}`);
    // Encode the image into binary
    const texture = encodeCutSceneTexture(palette, image);

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
    if (type === 2) {
      if (palSize !== 0x7d0) {
        throw new Error("Uncompressed invalid palette");
      }
    } else if (palSize < 0x20 || palSize > 0x80) {
      throw new Error("Invalid pal size");
    }

    const pal = Buffer.alloc(palSize);
    console.log("---- here ----");
    console.log(name);
    console.log(tim);
    for (let i = 0; i < 32; i++) {
      if (i < 16) {
        pal.writeUInt16LE(palette[i] || 0x0000, i * 2);
      } else {
        pal.writeUInt16LE(red, i * 2);
      }
    }

    let stop = false;
    if (!compressed) {
      // If not compressed, then we can just replace what's there
      console.log(`File: ${name}, Offset: 0x${offset.toString(16)}`);

      // Replace the existing palette
      for (let i = 0; i < pal.length; i++) {
        src[offset + 0x30 + i] = pal[i];
      }

      // Replace the texture
      for (let i = 0; i < texture.length; i++) {
        src[offset + 0x800 + i] = texture[i];
      }
    } else {
      // Otherwise we will need to compress and pray to god nothing breaks
      console.log(`File: ${name}, Offset: 0x${offset.toString(16)}`);

      const blocks = src.readUInt16LE(offset + 0x08);

      // Zero Out the Previous Data
      for (let i = offset + 0x30; i < end; i++) {
        src[i] = 0;
      }

      let makeBad = -1;
      switch (name) {
        case "cut-ST1CT.BIN":
        case "cut-ST25T.BIN":
        case "cut-ST30T.BIN":
        case "cut-ST3001T.BIN":
        case "cut-ST31T.BIN":
        case "cut-ST39T.BIN":
          makeBad = 1;
          break;
        case "cut-ST4BT.BIN":
        case "cut-ST15T.BIN":
        case "cut-ST17T.BIN":
          makeBad = 2;
          break;
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
        console.log(`${name} too short`);
        stop = true;
      } else {
        console.log("too long");
        stop = true;
      }
    }

    writeFileSync(`out/${name}`, src);
    if (stop) {
      throw new Error("Look at exported file");
    }
  });

  // Update the body for Miku in Apron
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

const updateApronBody2 = (src: Buffer) => {
  // Body
  const buffer = readFileSync(`miku/apron/body-01.png`);
  const palette: number[] = [];
  encodePalette(buffer, palette);
  if (palette.length > 16) {
    throw new Error("Too many colors for aprob bodyyyss texture");
  }

  // Eggs
  const eggsData = readFileSync(`miku/apron/eggs.png`);
  const eggPal: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const red = encodeTexel(255, 0, 0, 255);
  const green = encodeTexel(0, 255, 0, 255);

  const offset = 0x038800;
  const compressed = false;
  const texture = encodeEggTexture(palette, eggPal, buffer, eggsData);
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

  console.log("----- body image!!!!!!! ----");
  console.log(tim);

  const { type, fullSize } = tim;
  const palSize = fullSize - texture.length;
  if (palSize !== 0x7d0) {
    throw new Error("Uncompressed invalid palette");
  }

  const pal = Buffer.alloc(palSize);
  for (let i = 0; i < 32; i++) {
    if (i < 16) {
      pal.writeUInt16LE(palette[i] || 0x0000, i * 2);
    } else {
      pal.writeUInt16LE(eggPal[i % 16], i * 2);
    }
  }

  for (let i = 0; i < pal.length; i++) {
    src[offset + 0x30 + i] = pal[i];
    src[0x64830 + i] = pal[i];
  }

  // Replace the texture
  for (let i = 0; i < texture.length; i++) {
    src[offset + 0x800 + i] = texture[i];
    src[0x65000 + i] = texture[i];
  }
};

const appendRange = (range: Range[], s: number, e: number) => {
  // First, search for overlapping ranges
  for (let i = 0; i < range.length; i++) {
    const { start, end } = range[i];
    // Ends at the start of a previous range
    if (e === start) {
      range[i].start = s;
      return;
    }
    // Starts at the end of a previous range
    if (s === end) {
      range[i].end = e;
      return;
    }
  }

  range.push({ start: s, end: e });
  range.sort((a, b) => a.end - a.start - (b.end - b.start));
};

const getWriteOffset = (buffer: Buffer, data: Buffer, meta: Alloc) => {
  const { length } = data;

  // First search for available space
  for (let i = 0; i < meta.ranges.length; i++) {
    const { start, end } = meta.ranges[i];
    if (length > end - start) {
      continue;
    }
    console.log("Found space: ", start);
    meta.ranges[i].start += length;
    meta.ranges.sort((a, b) => a.end - a.start - (b.end - b.start));
    return start;
  }

  // Otherwise append to the file
  const { contentEnd } = meta;
  console.log("Data Length: 0x%s", length.toString(16));
  console.log("appending: 0x%s", contentEnd.toString(16));
  meta.contentEnd += length;
  return contentEnd;
};

const checkClear = (src: Buffer, meta: Alloc) => {
  const { ranges, contentEnd } = meta;

  ranges.forEach(({ start, end }) => {
    for (let i = start; i < end; i++) {
      if (src[i] !== 0) {
        throw new Error("Invalid clear 1");
      }
    }
  });

  for (let i = contentEnd; i < src.length; i++) {
    if (src[i] !== 0) {
      throw new Error("Invalid clear 2");
    }
  }
};

const clearMesh = (src: Buffer, headerOfs: number, meta: Alloc) => {
  const srcTriCount = src.readUInt8(headerOfs + 0);
  const srcQuadCount = src.readUInt8(headerOfs + 1);
  const srcVertCount = src.readUInt8(headerOfs + 2);

  const srcTriOfs = src.readUInt32LE(headerOfs + 4);
  const srcQuadOfs = src.readUInt32LE(headerOfs + 8);
  const srcVertOfs = src.readUInt32LE(headerOfs + 12);

  const srcTriEnd = srcTriOfs + srcTriCount * 12;
  const srcQuadEnd = srcQuadOfs + srcQuadCount * 12;
  const srcVertEnd = srcVertOfs + srcVertCount + 4;

  console.log(
    "Triangles: 0x%s to 0s%s",
    srcTriOfs.toString(16),
    srcTriEnd.toString(16),
  );
  console.log(
    "Quads: 0x%s to 0s%s",
    srcQuadOfs.toString(16),
    srcQuadEnd.toString(16),
  );
  console.log(
    "Vertices: 0x%s to 0s%s",
    srcVertOfs.toString(16),
    srcVertEnd.toString(16),
  );

  src.fill(0, srcTriOfs, srcTriEnd);
  src.fill(0, srcQuadOfs, srcQuadEnd);
  src.fill(0, srcVertOfs, srcVertEnd);

  src.writeUInt8(0, headerOfs + 0);
  src.writeUInt8(0, headerOfs + 1);
  src.writeUInt8(0, headerOfs + 2);
  src.writeUInt8(0, headerOfs + 3);

  src.writeUInt32LE(0, headerOfs + 4);
  src.writeUInt32LE(0, headerOfs + 8);
  src.writeUInt32LE(0, headerOfs + 12);

  appendRange(meta.ranges, srcTriOfs, srcTriEnd);
  appendRange(meta.ranges, srcQuadOfs, srcQuadEnd);
  appendRange(meta.ranges, srcVertOfs, srcVertEnd);
};

const packMesh = (
  src: Buffer,
  filename: string,
  headerOfs: number,
  meta: Alloc,
  isFace = false,
) => {
  // First we want to remove the existing content

  // Then we want to encode and pack
  const obj = readFileSync(filename, "ascii");
  const { tri, quad, vertices } = encodeMeshWithMaterial(obj);

  // Write Counts
  const triCount = Math.floor(tri.length / 12);
  const quadCount = Math.floor(quad.length / 12);
  const vertCount = Math.floor(vertices.length / 4);

  src.writeUInt8(triCount, headerOfs + 0);
  src.writeUInt8(quadCount, headerOfs + 1);
  src.writeUInt8(vertCount, headerOfs + 2);

  // Tri Offset
  console.log("tri");
  const triOfs = getWriteOffset(src, tri, meta);
  src.writeUInt32LE(triOfs, headerOfs + 4);
  for (let i = 0; i < tri.length; i++) {
    // if (src[triOfs + i] !== 0) {
    //   writeFileSync("out/debug-apron789.ebd", src);
    //   const errStr = `Tri ofs, not zero 0x${triOfs.toString(16)} ${i}`;
    //   throw new Error(errStr);
    // }
    src[triOfs + i] = tri[i];
  }

  // Quad Offset
  const quadOfs = getWriteOffset(src, quad, meta);
  src.writeUInt32LE(quadOfs, headerOfs + 8);
  console.log("quad");
  for (let i = 0; i < quad.length; i++) {
    // if (src[quadOfs + i] !== 0) {
    //   writeFileSync("out/debug-apron789.ebd", src);
    //   throw new Error("Quad ofs, not zero" + quadOfs);
    // }
    src[quadOfs + i] = quad[i];
  }

  // Vert Offset
  const vertOfs = getWriteOffset(src, vertices, meta);
  src.writeUInt32LE(vertOfs, headerOfs + 12);
  console.log("vertices");
  for (let i = 0; i < vertices.length; i++) {
    // if (src[vertOfs + i] !== 0) {
    //   writeFileSync("out/debug-apron789.ebd", src);
    //   throw new Error("Vert ofs, not zero" + vertOfs);
    // }
    src[vertOfs + i] = vertices[i];
  }

  return vertCount;
};

const fixEggs = (buffer: Buffer) => {
  // Image Coords
  const eggImgOfs = 0x4a1c;
  const imageX = 320;
  const imageY = 0;

  // const imageCoords = imageX >> 2;
  // buffer.writeUInt16LE(imageCoords, eggImgOfs);

  // Palette Coords
  const eggPalOfs = 0x4a1c + 2;
  const paletteX = 0 + 16;
  const paletteY = 241;
  const palCoords = (paletteX >> 4) | (paletteY << 6);
  buffer.writeUInt16LE(palCoords, eggPalOfs);

  // Attempt to fix egg palette issue

  // const textureOfs = [0x1e70, 0x1e74, 0x1e78];
  // const frameBufferCoords = buffer.readUInt32LE(textureOfs[0]);
  //
  //

  // process.exit();
};

const encodeApronMegaman = () => {
  encodeCutScenes();
  const file = readFileSync("out/cut-ST0305.BIN");
  updateDashie(file, "miku/paintings/dashie2.png");
  const contentEnd = file.readUInt32LE(0x04);
  const buffer = file.subarray(0x30, 0xe000);

  buffer.fill(0, contentEnd);

  writeFileSync("out/debug-apron000.ebd", buffer);

  const meta: Alloc = {
    ranges: [
      {
        start: 0x1f0,
        end: 0x1dc8,
      },
    ],
    contentEnd,
  };

  // Remove share vertices flag
  const heirarchyOfs = 0x1e24;
  const nbSegments = 19;
  let ofs = heirarchyOfs;
  let doStop = false;
  for (let i = 0; i < nbSegments; i++) {
    const flags = buffer.readUInt8(ofs + 3);
    console.log("%d) 0x%s", i, flags.toString(16));
    buffer.writeUInt8(flags & 0x3, ofs + 3);
    ofs += 4;
  }

  buffer.fill(0, 0xc0, 0x1dc8);
  fixEggs(buffer);
  // Body
  packMesh(buffer, "miku/apron/02_BODY.obj", 0xc0, meta); // 000

  // Hair
  packMesh(buffer, "miku/apron/01_HEAD_HAIR.obj", 0xd0, meta, true); // 001

  // Right Arm
  packMesh(buffer, "miku/apron/07_RIGHT_SHOULDER.obj", 0xe0, meta); // 002
  packMesh(buffer, "miku/apron/08_RIGHT_ARM.obj", 0xf0, meta); // 002
  packMesh(buffer, "miku/apron/09_RIGHT_HAND.obj", 0x100, meta); // 003

  // Left Arm
  packMesh(buffer, "miku/apron/04_LEFT_SHOULDER.obj", 0x110, meta); // 002
  packMesh(buffer, "miku/apron/05_LEFT_ARM.obj", 0x120, meta); // 002
  packMesh(buffer, "miku/apron/06_LEFT_HAND.obj", 0x130, meta); // 003

  // Hips (dont lie)
  packMesh(buffer, "miku/apron/03_HIPS.obj", 0x140, meta); // 002

  // Right Leg
  packMesh(buffer, "miku/apron/10_LEG_RIGHT_TOP.obj", 0x150, meta); // 002
  packMesh(buffer, "miku/apron/11_LEG_RIGHT_BOTTOM.obj", 0x160, meta); // 003
  packMesh(buffer, "miku/apron/12_RIGHT_FOOT.obj", 0x170, meta); // 002

  // Left Leg

  packMesh(buffer, "miku/apron/13_LEG_LEFT_TOP.obj", 0x180, meta); // 002
  packMesh(buffer, "miku/apron/14_LEG_LEFT_BOTTOM.obj", 0x190, meta); // 003
  packMesh(buffer, "miku/apron/15_LEFT_FOOT.obj", 0x1a0, meta); // 003

  console.log("encode face");
  packMesh(buffer, "miku/apron/01_HEAD_FACE.obj", 0x1b0, meta, true); // 015
  checkClear(buffer, meta);
  console.log("encode mouth");
  packMesh(buffer, "miku/apron/01_HEAD_MOUTH.obj", 0x1c0, meta, true); // 016
  console.log("encode hair");
  checkClear(buffer, meta);

  packMesh(buffer, "miku/apron/09_RIGHT_HAND_PLATE.obj", 0x1d0, meta); // 017
  packMesh(buffer, "miku/apron/06_LEFT_HAND_PAN.obj", 0x1e0, meta); // 018

  // Update Vertex Colors
  for (let ofs = 0x1e80; ofs < 0x2534; ofs += 4) {
    buffer[ofs + 0] = 0x7f;
    buffer[ofs + 1] = 0x7f;
    buffer[ofs + 2] = 0x7f;
    buffer[ofs + 3] = 0;
  }

  // Update the content length to read
  file.writeUInt32LE(meta.contentEnd, 0x04);
  // file.writeUInt32LE(0x1d, 0x08);

  if (meta.contentEnd > 0xe000) {
    throw new Error("File content too big");
  }

  // Update the Texture
  updateApronBody2(file);
  writeFileSync("out/cut-ST0305.BIN", file);
  writeFileSync("out/debug-apron456.ebd", buffer);

  // process.exit();
};

export default encodeApronMegaman;
export { packMesh, encodeApronMegaman, clearMesh };
