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

const SCALE = 0.00125;
const ROT = new Matrix4();
ROT.makeRotationX(Math.PI);

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
    bone.position.x = vec3.x;
    bone.position.y = vec3.y;
    bone.position.z = vec3.z;
    bones.push(bone);
  }

  // ** Heirarchy ** //

  const hierarchy: HierarchyStruct[] = [];
  const nbSegments = (textureOfs - heirarchyOfs) / 4;
  reader.seek(heirarchyOfs);
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
});
