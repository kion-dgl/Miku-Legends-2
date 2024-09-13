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
import { encodeMesh } from "./EncodeModel";
import { encodePalette, encodeCutSceneTexture } from "./EncodeTexture";

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

const updateApronBody2 = (src: Buffer) => {
  const buffer = readFileSync(`miku/miku_body.png`);
  const palette: number[] = [];
  encodePalette(buffer, palette);
  if (palette.length > 16) {
    throw new Error("Too many colors for aprob bodyyyss texture");
  }

  const offset = 0x038800;
  const compressed = false;
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
  if (palSize !== 0x7d0) {
    throw new Error("Uncompressed invalid palette");
  }

  const pal = Buffer.alloc(palSize);
  for (let i = 0; i < 16; i++) {
    pal.writeUInt16LE(palette[i] || 0x0000, i * 2);
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
};

const getWriteOffset = (buffer: Buffer, data: Buffer, meta: Alloc) => {
  const { length } = data;

  // First search for available space

  for (let i = 0; i < meta.ranges.length; i++) {
    const { start, end } = meta.ranges[i];
    if (length <= end - start) {
      meta.ranges[i].start += length;
    }
    console.log("Found space");
    return start;
  }

  console.log("appending");
  // Otherwise append to the file
  const { contentEnd } = meta;
  meta.contentEnd += length;
  return contentEnd;
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
) => {
  // First we want to remove the existing content

  // Then we want to encode and pack
  const obj = readFileSync(filename, "ascii");
  const { tri, quad, vertices } = encodeMesh(obj, 0);

  // Write Counts
  const triCount = Math.floor(tri.length / 12);
  const quadCount = Math.floor(quad.length / 12);
  const vertCount = Math.floor(vertices.length / 4);

  src.writeUInt8(triCount, headerOfs + 0);
  src.writeUInt8(quadCount, headerOfs + 1);
  src.writeUInt8(vertCount, headerOfs + 2);

  // Tri Offset
  const triOfs = getWriteOffset(src, tri, meta);
  src.writeUInt32LE(triOfs, headerOfs + 4);
  for (let i = 0; i < tri.length; i++) {
    src[triOfs + i] = tri[i];
  }

  // Quad Offset
  const quadOfs = getWriteOffset(src, quad, meta);
  src.writeUInt32LE(quadOfs, headerOfs + 8);
  for (let i = 0; i < quad.length; i++) {
    src[quadOfs + i] = quad[i];
  }

  // Vert Offset
  const vertOfs = getWriteOffset(src, vertices, meta);
  src.writeUInt32LE(vertOfs, headerOfs + 12);
  for (let i = 0; i < vertices.length; i++) {
    src[vertOfs + i] = vertices[i];
  }

  return vertCount;
};

const encodeApronMegaman = () => {
  const file = readFileSync("out/cut-ST0305.BIN");
  const contentEnd = file.readUInt32LE(0x04);
  const buffer = file.subarray(0x30, 0xe000);

  const meta: Alloc = {
    ranges: [],
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

    if (i < 9) {
      buffer.writeUInt8(flags & 0x83, ofs + 3);
    }

    ofs += 4;
  }

  // Remove Prior Mesh from File
  clearMesh(buffer, 0xc0, meta); // 000
  clearMesh(buffer, 0xd0, meta); // 001
  clearMesh(buffer, 0xe0, meta); // 002
  clearMesh(buffer, 0xf0, meta); // 003
  clearMesh(buffer, 0x100, meta); // 004
  clearMesh(buffer, 0x110, meta); // 005
  clearMesh(buffer, 0x120, meta); // 006
  clearMesh(buffer, 0x130, meta); // 007
  clearMesh(buffer, 0x140, meta); // 008
  clearMesh(buffer, 0x150, meta); // 009
  clearMesh(buffer, 0x160, meta); // 010
  clearMesh(buffer, 0x170, meta); // 011
  clearMesh(buffer, 0x180, meta); // 012
  clearMesh(buffer, 0x190, meta); // 013
  clearMesh(buffer, 0x1a0, meta); // 014
  clearMesh(buffer, 0x1b0, meta); // 015
  clearMesh(buffer, 0x1c0, meta); // 016
  clearMesh(buffer, 0x1d0, meta); // 017
  clearMesh(buffer, 0x1e0, meta); // 018

  packMesh(buffer, "miku/02_BODY.obj", 0xc0, meta); // 000
  packMesh(buffer, "miku/01_HEAD_HAIR.obj", 0xd0, meta); // 001

  packMesh(buffer, "miku/07_LEFT_SHOULDER.obj", 0xe0, meta); // 002
  packMesh(buffer, "miku/08_LEFT_ARM.obj", 0xf0, meta); // 003
  packMesh(buffer, "miku/09_LEFT_HAND.obj", 0x100, meta); // 004

  packMesh(buffer, "miku/04_RIGHT_SHOULDER.obj", 0x110, meta); // 005
  packMesh(buffer, "miku/05_RIGHT_ARM.obj", 0x120, meta); // 006
  packMesh(buffer, "miku/06_RIGHT_HAND.obj", 0x130, meta); // 007

  // 08 Bow Tie

  // Right Leg
  // packMesh(buffer, "miku/10_LEG_RIGHT_TOP.obj", 0x150, meta); // 009
  // packMesh(buffer, "miku/11_LEG_RIGHT_BOTTOM.obj", 0x160, meta); // 010
  // packMesh(buffer, "miku/12_RIGHT_FOOT.obj", 0x170, meta); // 011

  // Left Leg
  // packMesh(buffer, "miku/13_LEG_LEFT_TOP.obj", 0x180, meta); // 012
  // packMesh(buffer, "miku/14_LEG_LEFT_BOTTOM.obj", 0x190, meta); // 013
  // packMesh(buffer, "miku/15_LEFT_FOOT.obj", 0x1a0, meta); // 014

  console.log(meta);
  // Update the content length to read
  file.writeUInt32LE(meta.contentEnd, 0x04);

  // Update the Texture
  updateApronBody2(file);
  writeFileSync("out/cut-ST0305.BIN", file);
  writeFileSync("out/debug-apron.ebd", buffer);

  // process.exit();
};

export default encodeApronMegaman;
export { encodeApronMegaman };
