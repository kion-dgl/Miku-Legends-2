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

const packMesh = (
  src: Buffer,
  filename: string,
  headerOfs: number,
  meta: { gapStart: number; gapEnd: number; contentEnd: number },
) => {
  // First we want to remove the existing content

  const srcTriCount = src.readUInt8(headerOfs + 0);
  const srcQuadCount = src.readUInt8(headerOfs + 1);
  const srcVertCount = src.readUInt8(headerOfs + 2);

  const srcTriOfs = src.readUInt32LE(headerOfs + 4);
  const srcQuadOfs = src.readUInt32LE(headerOfs + 8);
  const srcVertOfs = src.readUInt32LE(headerOfs + 12);

  const srcTriEnd = srcTriOfs + srcTriCount * 12;
  const srcQuadEnd = srcQuadOfs + srcQuadCount * 12;
  const srcVertEnd = srcVertOfs + srcVertCount + 4;

  src.fill(0, srcTriOfs, srcTriEnd);
  src.fill(0, srcQuadOfs, srcQuadEnd);
  src.fill(0, srcVertOfs, srcVertEnd);

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
  src.writeUInt32LE(meta.contentEnd, headerOfs + 4);
  for (let i = 0; i < tri.length; i++) {
    src[meta.contentEnd++] = tri[i];
  }

  // Quad Offset
  src.writeUInt32LE(meta.contentEnd, headerOfs + 8);
  for (let i = 0; i < quad.length; i++) {
    src[meta.contentEnd++] = quad[i];
  }

  // Vert Offset
  src.writeUInt32LE(meta.contentEnd, headerOfs + 12);
  for (let i = 0; i < vertices.length; i++) {
    src[meta.contentEnd++] = vertices[i];
  }

  return vertCount;
};

const encodeApronMegaman = () => {
  const file = readFileSync("out/cut-ST0305.BIN");
  const contentEnd = file.readUInt32LE(0x04);
  const buffer = Buffer.from(file.subarray(0x30, 0xe000));

  const meta = {
    gapStart: -1,
    gapEnd: -1,
    contentEnd,
  };

  packMesh(buffer, "miku/02_BODY.obj", 0xc0, meta);
  file.writeUInt32LE(meta.contentEnd, 0x04);
  for (let i = 0; i < buffer.length; i++) {
    file[0x30 + i] = buffer[i];
  }

  // Update the Texture
  updateApronBody2(file);
  writeFileSync("out/cut-ST0305.BIN", file);
};

export default encodeApronMegaman;
export { encodeApronMegaman };
