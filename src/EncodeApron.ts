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
  const buffer = readFileSync(`miku/apron/ApronMikuTex.png`);
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
  const { tri, quad, vertices } = encodeMesh(obj, isFace ? 2 : 0);

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
    if (src[triOfs + i] !== 0) {
      writeFileSync("out/debug-apron789.ebd", src);
      const errStr = `Tri ofs, not zero 0x${triOfs.toString(16)} ${i}`;
      throw new Error(errStr);
    }
    src[triOfs + i] = tri[i];
  }

  // Quad Offset
  const quadOfs = getWriteOffset(src, quad, meta);
  src.writeUInt32LE(quadOfs, headerOfs + 8);
  console.log("quad");
  for (let i = 0; i < quad.length; i++) {
    if (src[quadOfs + i] !== 0) {
      writeFileSync("out/debug-apron789.ebd", src);
      throw new Error("Quad ofs, not zero" + quadOfs);
    }
    src[quadOfs + i] = quad[i];
  }

  // Vert Offset
  const vertOfs = getWriteOffset(src, vertices, meta);
  src.writeUInt32LE(vertOfs, headerOfs + 12);
  console.log("vertices");
  for (let i = 0; i < vertices.length; i++) {
    if (src[vertOfs + i] !== 0) {
      writeFileSync("out/debug-apron789.ebd", src);
      throw new Error("Vert ofs, not zero" + vertOfs);
    }
    src[vertOfs + i] = vertices[i];
  }

  return vertCount;
};

const encodeApronMegaman = () => {
  const file = readFileSync("out/cut-ST0305.BIN");

  // Get the Length of the content
  let contentEnd = file.readUInt32LE(0x04);
  const rollStart = 0x2534;
  const buffer = Buffer.from(file.subarray(0x30, 0xe800));

  // Clear out available space
  buffer.fill(0, 0xc0, rollStart);
  buffer.fill(0, contentEnd, buffer.length);

  // Remove share vertices flag
  const heirarchyOfs = 0x1e24;
  const nbSegments = 19;
  let ofs = heirarchyOfs;
  for (let i = 0; i < nbSegments; i++) {
    const flags = buffer.readUInt8(ofs + 3);
    buffer.writeUInt8(flags & 0x83, ofs + 3);
    ofs += 4;
  }

  // Update Vertex Color Offset
  buffer.writeUInt32LE(0x1f0, 0xa4);
  buffer.writeUInt32LE(0x1f0, 0xa8);
  buffer.writeUInt32LE(0x1f0, 0xac);

  const files = [
    // 000 Body
    {
      offset: 0xc0,
      name: "miku/apron/mesh_000.obj",
      matId: 0,
    },
    // 001 Head
    {
      offset: 0xd0,
      name: "miku/apron/10_HELMET_buns.obj",
      matId: 0,
    },
    // 002 Right Shoulder
    {
      offset: 0xe0,
      name: "miku/apron/mesh_002.obj",
      matId: 0,
    },
    // 003 Right Arm
    {
      offset: 0xf0,
      name: "miku/05_RIGHT_ARM.obj",
      matId: 0,
    },
    // 004 Right Hand
    {
      offset: 0x100,
      name: "miku/apron/mesh_004.obj",
      matId: 0,
    },
    // 005 Left Shoulder
    {
      offset: 0x110,
      name: "miku/apron/mesh_005.obj",
      matId: 0,
    },
    // 006 left Arm
    {
      offset: 0x120,
      name: "miku/08_LEFT_ARM.obj",
      matId: 0,
    },
    // 007 Left Hand
    {
      offset: 0x130,
      name: "miku/apron/mesh_007.obj",
      matId: 0,
    },
    // 008 Bow Tie
    {
      offset: 0x140,
      name: "miku/apron/mesh_008.obj",
      matId: 0,
    },
    // 009 Right Leg Top
    {
      offset: 0x150,
      name: "miku/10_LEG_RIGHT_TOP.obj",
      matId: 0,
    },
    // 010 Right Leg Lower
    {
      offset: 0x160,
      name: "miku/apron/mesh_010.obj",
      matId: 0,
    },
    // 011 Right Foot
    {
      offset: 0x170,
      name: "miku/apron/mesh_011.obj",
      matId: 0,
    },
    // 012 left Leg Top
    {
      offset: 0x180,
      name: "miku/13_LEG_LEFT_TOP.obj",
      matId: 0,
    },
    // 013 Right Leg Lower
    {
      offset: 0x190,
      name: "miku/apron/mesh_013.obj",
      matId: 0,
    },
    // 014 Left Foot
    {
      offset: 0x1a0,
      name: "miku/apron/mesh_014.obj",
      matId: 0,
    },
    // 015 Face
    {
      offset: 0x1b0,
      name: "miku/01_HEAD_FACE.obj",
      matId: 2,
    },
    // 016 Mouth
    {
      offset: 0x1c0,
      name: "miku/01_HEAD_MOUTH.obj",
      matId: 2,
    },
    // 017 Hand with Plate
    // {
    //   offset: 0x1d0,
    //   name: "miku/apron/mesh_017.obj",
    //   matId: 0,
    // },
    // 018 Hand with Frypan
    {
      offset: 0x1e0,
      name: "miku/apron/mesh_018.obj",
      matId: 0,
    },
  ];

  ofs = 0x1f0;
  const encodedModel = files.map(({ name, matId, offset }) => {
    const obj = readFileSync(name, "ascii");
    const { tri, quad, vertices } = encodeMesh(obj, matId);

    // Write Counts
    const triCount = Math.floor(tri.length / 12);
    const quadCount = Math.floor(quad.length / 12);
    const vertCount = Math.floor(vertices.length / 4);
    for (let i = 0; i < vertCount; i++) {
      buffer[ofs + 0] = 0x79;
      buffer[ofs + 1] = 0x79;
      buffer[ofs + 2] = 0x79;
      ofs += 4;
    }

    return { tri, quad, vertices, triCount, quadCount, vertCount, offset };
  });

  console.log(" ------- ");
  console.log("Content Offset: 0x%s", ofs.toString(16));

  encodedModel.forEach(
    ({ tri, quad, vertices, triCount, quadCount, vertCount, offset }) => {
      buffer.writeUInt8(triCount, offset + 0);
      buffer.writeUInt8(quadCount, offset + 1);
      buffer.writeUInt8(vertCount, offset + 2);

      // Triangles
      let triOfs = -1;
      if (ofs + tri.length <= rollStart) {
        triOfs = ofs;
        ofs += tri.length;
      } else {
        triOfs = contentEnd;
        contentEnd += tri.length;
      }

      buffer.writeUInt32LE(triOfs, offset + 4);
      for (let i = 0; i < tri.length; i++) {
        buffer[triOfs + i] = tri[i];
      }

      // Quads
      let quadOfs = -1;
      if (ofs + quad.length <= rollStart) {
        quadOfs = ofs;
        ofs += quad.length;
      } else {
        quadOfs = contentEnd;
        contentEnd += quad.length;
      }

      buffer.writeUInt32LE(quadOfs, offset + 8);
      for (let i = 0; i < quad.length; i++) {
        buffer[quadOfs + i] = quad[i];
      }

      // Vertices
      let vertOfs = -1;
      if (ofs + vertices.length <= rollStart) {
        vertOfs = ofs;
        ofs += vertices.length;
      } else {
        vertOfs = contentEnd;
        contentEnd += vertices.length;
      }

      buffer.writeUInt32LE(vertOfs, offset + 12);
      for (let i = 0; i < vertices.length; i++) {
        buffer[vertOfs + i] = vertices[i];
      }
    },
  );

  // Update the content length to read
  file.writeUInt32LE(contentEnd, 0x04);

  console.log("Content end: 0x%s", contentEnd.toString(16));
  if (contentEnd > 0xe000 && contentEnd <= 0xe800) {
    // Shift the MegaMan Body Texture Down by 0x800 bytes
    const image = Buffer.from(file.subarray(0xe000, 0x17000));
    for (let i = 0; i < image.length; i++) {
      file[0xe800 + i] = image[i];
    }
    file.writeUInt32LE(0x1d, 0x08);
  } else if (contentEnd > 0xe800) {
    throw new Error("File content too big");
  }

  for (let i = 0; i < contentEnd; i++) {
    file[0x30 + i] = buffer[i];
  }

  writeFileSync("out/debug-apron.ebd", buffer);
  // Update the Texture
  updateApronBody2(file);
  writeFileSync("out/cut-ST0305.BIN", file);

  // process.exit();
};

export default encodeApronMegaman;
export { encodeApronMegaman };
