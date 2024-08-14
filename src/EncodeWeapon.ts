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
import { encodeMesh } from "./EncodeModel";
import { readFileSync, writeFileSync } from "fs";

// 00 - Lifter
// 01 - Kick
// 02 - Mega Buster
// 03 - Crusher
// 04 - Buster Cannon
// 05 - Hyper Shell
// 06 - Homing Missile
// 07 - Ground Crawler
// 08 - Vacuum Arm
// 09 - Reflector Arm
// 0A - Shield Arm
// 0B - Blade Arm
// 0C - Shining Laser
// 0D - Machinegun Arm
// 0E - Spread Buster
// 0F - Aqua Blaster
// 10 - Hunter Seeker
// 11 - Drill Arm

type DrawCall = {
  vertexCount: number;
  triCount: number;
  quadCount: number;
  vertexList: Buffer;
  triList: Buffer;
  quadList: Buffer;
  vertexColors: Buffer;
};

// For encode object, we want to take an object file and then encode
// the vertices, triangles, quads and vertex colors, and we return an object
// with the counts and
const encodeObj = (obj: string): DrawCall => {
  const MATERIAL_INDEX = 3;
  const { tri, quad, vertices } = encodeMesh(obj, 3);
  const triCount = tri.length / 12;
  const quadCount = quad.length / 12;
  const vertexCount = vertices.length / 4;
  const vertexColors = Buffer.alloc(vertices.length, 0);
  for (let i = 0; i < vertexColors.length; i += 4) {
    vertexColors[i + 0] = 0x7c;
    vertexColors[i + 1] = 0x7c;
    vertexColors[i + 2] = 0x7c;
  }
  return {
    vertexCount,
    triCount,
    quadCount,
    vertexList: vertices,
    triList: tri,
    quadList: quad,
    vertexColors,
  };
};
const extractBullet = (src: Buffer, offset: number): DrawCall => {
  // Notes for the header and length

  const HEADER_LEN = 0x48;
  const POINTER_ADJUST = 0x2b40;

  // Slice off to the location minus the header
  const sub = src.subarray(offset + 0x30);
  const triCount = sub.readUInt8(0x30);
  const quadCount = sub.readUInt8(0x31);
  const vertexCount = sub.readUInt8(0x32);

  const triOfs = sub.readUInt32LE(0x34) - POINTER_ADJUST;
  const quadOfs = sub.readUInt32LE(0x38) - POINTER_ADJUST;
  const vertOfs = sub.readUInt32LE(0x3c) - POINTER_ADJUST;
  const vertColorOfs = sub.readUInt32LE(0x40) - POINTER_ADJUST;

  const triList = Buffer.from(sub.subarray(triOfs, triOfs + triCount * 12));
  const quadList = Buffer.from(sub.subarray(quadOfs, quadOfs + quadCount * 12));
  const vertexList = Buffer.from(
    sub.subarray(vertOfs, vertOfs + vertexCount * 4),
  );
  const vertexColors = Buffer.from(
    sub.subarray(vertColorOfs, vertColorOfs + vertexCount * 4),
  );

  return {
    triCount,
    quadCount,
    vertexCount,
    triList,
    quadList,
    vertexList,
    vertexColors,
  };
};

const replaceShieldArm = (objFile: string) => {
  const MEM_OFFSET = 0x2b88;
  // Load the weapon with updated palette
  const SHIELD_ARM_PATH = "./out/PL00R0A.BIN";
  const SHIELD_ARM_OFFSET = 0x1800;
  const file = readFileSync(SHIELD_ARM_PATH);

  // First we read the right shoulder
  const shoulder = readFileSync("./miku/04_RIGHT_SHOULDER.obj").toString(
    "ascii",
  );
  const weapon = readFileSync(objFile).toString("ascii");

  const mesh0 = encodeObj(shoulder);
  const mesh1 = encodeObj(weapon);
  const mesh2 = extractBullet(file, SHIELD_ARM_OFFSET);
  const meshes = [mesh0, mesh1, mesh2];

  // Zero out the prior mesh
  for (let i = 0x1830; i < 0x2000; i++) {
    file[i] = 0;
  }

  let headerOfs = 0x1830;
  let contentOfs = 0x1878;
  let pointerOfs = 0x2b88;
  meshes.forEach((mesh) => {
    file.writeUInt8(headerOfs + 0, mesh.triCount);
    file.writeUInt8(headerOfs + 1, mesh.quadCount);
    file.writeUInt8(headerOfs + 2, mesh.vertexCount);

    // Triangles
    file.writeUInt32LE(headerOfs + 4, pointerOfs);
    for (let i = 0; i < mesh.triList.length; i++) {
      file[contentOfs++] = mesh.triList[i];
    }
    pointerOfs += mesh.triList.length;

    // Quads
    file.writeUInt32LE(headerOfs + 8, pointerOfs);
    for (let i = 0; i < mesh.quadList.length; i++) {
      file[contentOfs++] = mesh.quadList[i];
    }
    pointerOfs += mesh.quadList.length;

    // vertices
    file.writeUInt32LE(headerOfs + 0x0c, pointerOfs);
    for (let i = 0; i < mesh.vertexList.length; i++) {
      file[contentOfs++] = mesh.vertexList[i];
    }
    pointerOfs += mesh.vertexList.length;

    // Vertex Color
    file.writeUInt32LE(headerOfs + 0x10, pointerOfs);
    for (let i = 0; i < mesh.vertexColors.length; i++) {
      file[contentOfs++] = mesh.vertexColors[i];
    }
    pointerOfs += mesh.vertexColors.length;

    // Vertex Color
    file.writeUInt32LE(headerOfs + 0x14, pointerOfs);
    for (let i = 0; i < mesh.vertexColors.length; i++) {
      file[contentOfs++] = mesh.vertexColors[i];
    }
    pointerOfs += mesh.vertexColors.length;

    // Update Header
    headerOfs += 0x18;
  });

  if (contentOfs > 0x2000) {
    throw new Error("Shield Arm is too long!!!!");
  }
  const len = contentOfs - 0x1830;
  file.writeUInt32LE(0x1804, len);
  writeFileSync("./out/PL00R0A.BIN", file);
};

export { replaceShieldArm };
