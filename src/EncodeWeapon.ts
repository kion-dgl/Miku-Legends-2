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
const encodeObj = (obj: string, matIndex: number): DrawCall => {
  const { tri, quad, vertices } = encodeMesh(obj, matIndex, true);
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

const replaceWeapon = (srcFile: string, srcOffset: number, objFile: string) => {
  const MEM_OFFSET = 0x2b88;
  // Load the weapon with updated
  const file = readFileSync(srcFile);

  // First we read the right shoulder
  const shoulder = readFileSync("./miku/04_RIGHT_SHOULDER.obj").toString(
    "ascii",
  );
  const weapon = readFileSync(objFile).toString("ascii");

  const mesh0 = encodeObj(shoulder, 0); // Body Mesh
  const mesh1 = encodeObj(weapon, 3); // Special Weapon
  const mesh2 = extractBullet(file, srcOffset);
  const meshes = [mesh0, mesh1, mesh2];

  // Zero out the prior mesh
  for (let i = srcOffset + 0x30; i < srcOffset + 0x800; i++) {
    file[i] = 0;
  }

  let headerOfs = srcOffset + 0x30;
  let contentOfs = srcOffset + 0x80;
  let pointerOfs = 0x2b88 + 0x18;

  const dot = srcFile.indexOf(".BIN");
  const char = srcFile.substring(dot - 2, dot);
  console.log(srcFile.substring(dot));
  const DEBUG_MEM = Buffer.from(`-- SPWPN 0x${char} --`, "ascii");
  console.log(DEBUG_MEM.toString("ascii"));
  if (DEBUG_MEM.length !== 16) {
    throw new Error("Invalid debug string length");
  }

  for (let i = 0; i < DEBUG_MEM.length; i++) {
    file[contentOfs++] = DEBUG_MEM[i];
  }
  meshes.forEach((mesh) => {
    console.log("header Offset: 0x%s", headerOfs.toString(16));
    console.log("Counts: ", mesh.triCount, mesh.quadCount, mesh.vertexCount);
    file.writeUInt8(mesh.triCount, headerOfs + 0);
    file.writeUInt8(mesh.quadCount, headerOfs + 1);
    file.writeUInt8(mesh.vertexCount, headerOfs + 2);

    // Triangles
    file.writeUInt32LE(pointerOfs, headerOfs + 4);
    for (let i = 0; i < mesh.triList.length; i++) {
      file[contentOfs++] = mesh.triList[i];
    }
    pointerOfs += mesh.triList.length;

    // Quads
    file.writeUInt32LE(pointerOfs, headerOfs + 8);
    for (let i = 0; i < mesh.quadList.length; i++) {
      file[contentOfs++] = mesh.quadList[i];
    }
    pointerOfs += mesh.quadList.length;

    // vertices
    file.writeUInt32LE(pointerOfs, headerOfs + 0x0c);
    for (let i = 0; i < mesh.vertexList.length; i++) {
      file[contentOfs++] = mesh.vertexList[i];
    }
    pointerOfs += mesh.vertexList.length;

    // Vertex Color
    file.writeUInt32LE(pointerOfs, headerOfs + 0x10);
    for (let i = 0; i < mesh.vertexColors.length; i++) {
      file[contentOfs++] = mesh.vertexColors[i];
    }
    pointerOfs += mesh.vertexColors.length;

    // Vertex Color
    file.writeUInt32LE(pointerOfs, headerOfs + 0x14);
    for (let i = 0; i < mesh.vertexColors.length; i++) {
      file[contentOfs++] = mesh.vertexColors[i];
    }
    pointerOfs += mesh.vertexColors.length;

    // Update Header
    headerOfs += 0x18;
  });

  if (contentOfs > srcOffset + 0x800) {
    throw new Error("Weapon is too long!!!!");
  }

  const len = contentOfs - (srcOffset + 0x30);
  console.log("Length: 0x%s", len);
  file.writeUInt32LE(len, srcOffset + 0x4);
  writeFileSync(srcFile, file);
};

// 0x02
const replaceCrusher = (objFile: string) => {
  const filename = "./out/PL00R02.BIN";
  const MEM_START = 0x2000;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x03
const replaceBusterCannon = (objFile: string) => {
  const filename = "./out/PL00R03.BIN";
  const MEM_START = 0x2000;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x05
const replaceHomingMissle = (objFile: string) => {
  const filename = "./out/PL00R05.BIN";
  const MEM_START = 0x800;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x06
const replaceGroundCrawler = (objFile: string) => {
  const filename = "./out/PL00R06.BIN";
  const MEM_START = 0x1000;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x07
const replaceVacuumArm = (objFile: string) => {
  const filename = "./out/PL00R07.BIN";
  const MEM_START = 0x1000;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x08
const replaceReflectorArm = (objFile: string) => {
  const filename = "./out/PL00R08.BIN";
  const MEM_START = 0x1000;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x09
const replaceShieldArm = (objFile: string) => {
  const filename = "./out/PL00R09.BIN";
  const MEM_START = 0x2000;
  replaceWeapon(filename, MEM_START, objFile);
};

// 0x0A
const replaceBladeArm = (objFile: string) => {
  const filename = "./out/PL00R0A.BIN";
  const MEM_START = 0x1800;
  replaceWeapon(filename, MEM_START, objFile);
};

export {
  replaceCrusher, // 0x02
  replaceBusterCannon, // 0x03
  replaceHomingMissle, // 0x05
  replaceGroundCrawler,
  replaceVacuumArm,
  replaceReflectorArm,
  replaceBladeArm,
  replaceShieldArm,
};
