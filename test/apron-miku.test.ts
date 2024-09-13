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
import ByteReader from "../src/ByteReader";

import { Bone, Vector3, Matrix4 } from "three";
import { readVertexList, readFace } from "../src/MeshReader";

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
  writeFileSync(`fixtures/APRON/${outName}.png`, buffer);
  return imageData;
};

// The first thing we need to do is iterate through the files and export all of the textures
// once we've located the spectific megaman textures, then we will update the test to export
// the specific one and write a fixture for it

test("it should dump all of the textures, from the texture files", () => {
  const INPUT = ["cut-ST03T.BIN"];

  console.log("----================= Yeeeallo =================----");

  let img: number[] = [];
  INPUT.forEach((filename) => {
    const file = readFileSync(`bin/${filename}`);
    for (let i = 0x43000; i <= 0x46000; i += 0x800) {
      const type = file.readUInt32LE(i + 0x00);
      const fullSize = file.readUInt32LE(i + 0x04);
      const colorCount = file.readUInt16LE(i + 0x10);
      const paletteCount = file.readUInt16LE(i + 0x12);
      const width = file.readUInt16LE(i + 0x18);
      const height = file.readUInt16LE(i + 0x1a);

      if (fullSize % 4 !== 0) {
        continue;
      }

      if (fullSize < 0x20) {
        continue;
      }

      const name = `${filename}-${i.toString(16).padStart(6, "0")}-true`;

      if (type === 0x02) {
        console.log("Palette found");

        let ofs = i + 0x30;
        const palette: Pixel[][] = new Array();
        for (let i = 0; i < paletteCount; i++) {
          palette[i] = new Array();
          for (let k = 0; k < colorCount; k++) {
            const word = file.readUInt16LE(ofs);
            ofs += 2;
            palette[i].push(wordToColor(word));
          }
        }

        const png = new PNG({ width: 256, height: 256 });

        let index = 0;
        let dst = 0;
        for (let y = 0; y < 256; y++) {
          for (var x = 0; x < 256; x++) {
            const colorIndex = img[index++];
            const { r, g, b, a } = palette[0][colorIndex!];

            if (y < 1) {
              console.log(r, g, b, a);
            }
            png.data[dst++] = r;
            png.data[dst++] = g;
            png.data[dst++] = b;
            png.data[dst++] = a;
          }
        }

        // Export file
        const buffer = PNG.sync.write(png);
        writeFileSync(`fixtures/APRON/${name}.png`, buffer);
      }

      if (width === 0 || height === 0) {
        continue;
      }

      if (type !== 0x03) {
        continue;
      }

      console.log(`Compressed texture 0x${i.toString(16).padStart(6, "0")}`);
      // if (colorCount === 0) {
      //   console.log("no palette, skipping");
      //   continue;
      // }
      const src = file.subarray(i);

      const p = renderTexture(src, name);
      img = img.length == 0 ? p : img;
    }
  });
});

test("it should create a obj of apron megaman", () => {
  const file = readFileSync("bin/ST0305.BIN");
  const length = file.readUInt32LE(0x04);
  const buffer = Buffer.from(file.subarray(0x30, 0x30 + length));
  const reader = new ByteReader(buffer.buffer as ArrayBuffer);
  writeFileSync("fixtures/apron.ebd", buffer);

  const count = reader.readUInt32();
  expect(count).toEqual(8);
  const list: EntityHeader[] = [];

  for (let i = 0; i < count; i++) {
    const rawId = reader.readUInt32();
    const id = `0x${rawId.toString(16).padStart(6, "0")}`;
    const meshOfs = reader.readUInt32();
    const tracksOfs = reader.readUInt32();
    const controlOfs = reader.readUInt32();

    list.push({
      id,
      meshOfs,
      tracksOfs,
      controlOfs,
    });
  }

  // Start Reading Apron MegaMan
  const { meshOfs } = list[0];
  reader.seek(meshOfs);

  // Read the Submesh Count
  const submeshCount = reader.readUInt8();
  expect(submeshCount).toEqual(19);

  // Read the Geometry Offset
  reader.seek(meshOfs + 4);
  const geometryOfs = reader.readUInt32();
  expect(geometryOfs).toEqual(0xc0);

  // Get the offset to the bones
  reader.seek(meshOfs + 0x10);
  const skeletonOfs = reader.readUInt32();
  const heirarchyOfs = reader.readUInt32();

  expect(skeletonOfs).toEqual(0x1dc8);
  expect(heirarchyOfs).toEqual(0x1e24);

  // Get offset to the textures
  const textureOfs = reader.readUInt32();
  const collisionOfs = reader.readUInt32();
  const shadowOfs = reader.readUInt32();

  expect(textureOfs).toEqual(0x1e70);
  expect(collisionOfs).toEqual(0);
  expect(shadowOfs).toEqual(0x1e80);

  // ** BONES ** //

  const bones: Bone[] = [];

  const nbBones = Math.floor((heirarchyOfs - skeletonOfs) / 6);
  reader.seek(skeletonOfs);
  const SCALE = 0.00125;
  const ROT = new Matrix4();
  ROT.makeRotationX(Math.PI);

  for (let i = 0; i < nbBones; i++) {
    // Read Bone Position
    const x = reader.readInt16();
    const y = reader.readInt16();
    const z = reader.readInt16();

    // Create Threejs Bone
    const bone = new Bone();
    bone.name = `bone_${i.toString().padStart(3, "0")}`;
    const vec3 = new Vector3(x, y, z);
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT);

    console.log(i, vec3.y);
    bone.position.x = vec3.x;
    bone.position.y = vec3.y;
    bone.position.z = vec3.z;
    bones.push(bone);
  }

  // ** Texture ** //
  const mats: TextureCoords[] = [];
  if (textureOfs) {
    reader.seek(textureOfs);
    const textureCount = ((collisionOfs || shadowOfs) - textureOfs) / 4;
    for (let i = 0; i < textureCount; i++) {
      const imageCoords = reader.readUInt16();
      const paletteCoords = reader.readUInt16();
      const imageX = (imageCoords & 0x0f) << 6;
      const imageY = imageCoords & 0x10 ? 0x100 : 0;

      const paletteX = (paletteCoords & 0x3f) << 4;
      const paletteY = paletteCoords >> 6;
      mats.push({ imageX, imageY, paletteX, paletteY });
    }
  }

  expect(mats).toEqual([
    {
      imageX: 320,
      imageY: 0,
      paletteX: 0,
      paletteY: 241,
    },
    {
      imageX: 320,
      imageY: 0,
      paletteX: 64,
      paletteY: 241,
    },
    {
      imageX: 384,
      imageY: 0,
      paletteX: 128,
      paletteY: 241,
    },
    {
      imageX: 320,
      imageY: 0,
      paletteX: 192,
      paletteY: 241,
    },
  ]);

  // ** Heirarchy ** //

  const hierarchy: HierarchyStruct[] = [];
  const nbSegments = (textureOfs - heirarchyOfs) / 4;
  reader.seek(heirarchyOfs);
  expect(heirarchyOfs).toBe(0x1e24);
  expect(nbSegments).toBe(19);
  for (let i = 0; i < nbSegments; i++) {
    const polygonIndex = reader.readInt8();
    const boneParent = reader.readInt8();
    const boneIndex = reader.readUInt8();
    const flags = reader.readUInt8();
    const hidePolygon = Boolean(flags & 0x80);
    const shareVertices = Boolean(flags & 0x40);

    if (bones[boneIndex] && bones[boneParent] && !bones[boneIndex].parent) {
      bones[boneParent].add(bones[boneIndex]);
    }

    // expect(shareVertices).toBeFalse();

    if (flags & 0x3f) {
      console.error(`Unknown Flag: 0x${(flags & 0x3f).toString(16)}`);
    }

    hierarchy.push({
      polygonIndex,
      boneIndex,
      boneParent,
      hidePolygon,
      shareVertices,
    });
  }

  bones.forEach((bone) => {
    bone.updateMatrix();
    bone.updateMatrixWorld();
  });

  // ** Read Geomtry ** //

  const modelVertices: string[] = [];
  const modelFaces: string[] = [];

  for (let i = 0; i < submeshCount; i++) {
    // Read triangle offset and count
    reader.seek(geometryOfs + i * 0x10);
    const triCount = reader.readUInt8();
    const quadCount = reader.readUInt8();
    const vertCount = reader.readUInt8();
    const scaleBytes = reader.readUInt8();
    const triOfs = reader.readUInt32();
    const quadOfs = reader.readUInt32();
    const vertOfs = reader.readUInt32();

    // Read Scale
    const scale = scaleBytes === -1 ? 0.5 : 1 << scaleBytes;
    const { boneIndex, boneParent, shareVertices } = hierarchy[i];
    const bone = bones[boneIndex];

    // Read Vertices
    const vertices = readVertexList(reader, vertOfs, vertCount);
    const tris = readFace(reader, triOfs, triCount, false);
    const quads = readFace(reader, quadOfs, quadCount, true);

    const obj: string[] = [];
    const w = modelVertices.length + 1;
    vertices.forEach((vec3) => {
      const { x, y, z } = vec3;
      obj.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
      vec3.applyMatrix4(bone.matrixWorld);
      modelVertices.push(
        `v ${vec3.x.toFixed(3)} ${vec3.y.toFixed(3)} ${vec3.z.toFixed(3)}`,
      );
    });

    tris.forEach((face) => {
      const [a, b, c] = face;
      console.log(a.materialIndex);
      obj.push(`f ${a.index + 1} ${b.index + 1} ${c.index + 1}`);
      modelFaces.push(`f ${a.index + w} ${b.index + w} ${c.index + w}`);
    });

    quads.forEach((face) => {
      const [a, b, c, d] = face;
      console.log(a.materialIndex);
      obj.push(`f ${a.index + 1} ${b.index + 1} ${d.index + 1} ${c.index + 1}`);
      modelFaces.push(
        `f ${a.index + w} ${b.index + w} ${d.index + w} ${c.index + w}`,
      );
    });

    const name = `mesh_${i.toString().padStart(3, "0")}`;
    writeFileSync(`./fixtures/APRON/${name}.OBJ`, obj.join("\n"));
  }

  writeFileSync(
    `./fixtures/APRON/full.OBJ`,
    modelVertices.join("\n") + modelFaces.join("\n"),
  );
});
