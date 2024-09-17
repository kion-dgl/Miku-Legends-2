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
import { Vector3, Matrix4 } from "three";
import ByteReader from "./ByteReader";

type PackBuffer = {
  dataOfs: number; // Where to write the offset
  data: Buffer; // The data to be packed
};

type Primitive = {
  tri: Buffer;
  quad: Buffer;
  vertices: Buffer;
};

type FaceDef = {
  mat: number;
  line: string;
};

const encodeVertexBits = (num: number) => {
  if (num < 0) {
    const lowBits = 512 + num;
    const encodedVert = 0x200 | lowBits;
    if (encodedVert > 0x3ff) {
      return 0x3ff;
      throw new Error("Encoded vertex is too larged (neg)");
    }
    return encodedVert;
  } else {
    if (num > 0x1ff) {
      return 0x1ff;
      throw new Error("Encoded vertex is too larged (pos)");
    }
    return num;
  }
};

const encodeVertex = (x: number, y: number, z: number) => {
  try {
    const xInt = encodeVertexBits(x);
    const yInt = encodeVertexBits(y);
    const zInt = encodeVertexBits(z);
    // Shift and merge vertex to make a 32 bit value
    const vertex = xInt | (yInt << 10) | (zInt << 20);
    return vertex;
  } catch (err) {
    console.log("0 Scale invalid: ", x, y, z);
  }

  try {
    const xInt = encodeVertexBits(Math.floor(x / 2));
    const yInt = encodeVertexBits(Math.floor(y / 2));
    const zInt = encodeVertexBits(Math.floor(z / 2));
    // Shift and merge vertex to make a 32 bit value
    const vertex = xInt | (yInt << 10) | (zInt << 20) | (1 << 30);
    return vertex;
  } catch (err) {
    console.log("1 Scale invalid: ", x, y, z);
    throw err;
  }
};

const encodeMesh = (
  obj: string,
  materialIndex: number,
  debugUV = false,
): Primitive => {
  const SCALE = 1 / 0.00125;
  const ROT_X = new Matrix4();
  ROT_X.makeRotationX(Math.PI);

  // First step is to break the file down into primitives
  const lines = obj.split("\n");
  const verts: string[] = [];
  const uvs: string[] = [];
  const tris: string[] = [];
  const quads: string[] = [];

  lines.forEach((line) => {
    if (line.indexOf("v ") === 0) {
      verts.push(line);
    }

    if (line.indexOf("vt ") === 0) {
      uvs.push(line);
    }

    if (line.indexOf("f ") === 0) {
      const parts = line.split(" ");
      let edge = 0;
      parts.forEach((p) => {
        edge += p.indexOf("/") !== -1 ? 1 : 0;
      });
      switch (edge) {
        case 3:
          tris.push(line);
          break;
        case 4:
          quads.push(line);
          break;
        default:
          throw new Error("Wait, what the fuck? " + line);
          break;
      }
    }
  });

  const vertices = Buffer.alloc(verts.length * 4, 0);
  let vertOfs = 0;
  for (let i = 0; i < verts.length; i++) {
    // Extract string values for x,y,z
    const v = verts[i].split(" ");
    const xRaw = parseFloat(v[1]);
    const yRaw = parseFloat(v[2]);
    const zRaw = parseFloat(v[3]);

    // // Scale and rotate to match psx orientation
    const vec3 = new Vector3(xRaw, yRaw, zRaw);
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT_X);
    // vec3.applyMatrix4(ROT_Y);

    // // Round each value to nearest whole int
    vec3.x = Math.round(vec3.x);
    vec3.y = Math.round(vec3.y);
    vec3.z = Math.round(vec3.z);

    // // Encode x,y,z to signed 10 but values
    const { x, y, z } = vec3;

    // Shift and merge vertex to make a 32 bit value
    const vertex = encodeVertex(x, y, z);
    vertices.writeUInt32LE(vertex, vertOfs);
    vertOfs += 4;
  }

  const pixels: [number, number][] = [];

  for (let i = 0; i < uvs.length; i++) {
    // Parse the information from the string
    const uv = uvs[i].split(" ");

    const uRaw = parseFloat(uv[1]);
    // Flip V
    const vRaw = 1 - parseFloat(uv[2]);

    // // Approximate the pixel
    const uAdjusted = uRaw * 255;
    const vAdjusted = vRaw * 255;

    // Eniminate rounding to make sure it's a pixel reference
    // const adjust = debugUV ? 1 : 1
    const uFloor = Math.round(uAdjusted);
    const vFloor = Math.round(vAdjusted + 0.5);

    // // Make sure it fits in one byte
    const u = uFloor > 255 ? 255 : uFloor < 0 ? 0 : uFloor;
    const v = vFloor > 255 ? 255 : vFloor < 0 ? 0 : vFloor;

    // Push the pixels to be referenced
    pixels.push([u, v]);
  }

  // Encode the triangles for each of the faces
  const FACE_MASK = 0x7f;
  const tri = Buffer.alloc(tris.length * 12, 0);
  let triOfs = 0;
  for (let i = 0; i < tris.length; i++) {
    const f = tris[i].split(" ");

    const [aStr, aIdx] = f[2].split("/");
    const [bStr, bIdx] = f[1].split("/");
    const [cStr, cIdx] = f[3].split("/");

    // Obj Indices start at 1 not 0
    const a = parseInt(aStr) - 1;
    const b = parseInt(bStr) - 1;
    const c = parseInt(cStr) - 1;

    // Same, Obj Indices start at 1 not 0
    const [au, av] = pixels[parseInt(aIdx) - 1];
    const [bu, bv] = pixels[parseInt(bIdx) - 1];
    const [cu, cv] = pixels[parseInt(cIdx) - 1];

    tri.writeUInt8(au, triOfs);
    triOfs++;
    tri.writeUInt8(av, triOfs);
    triOfs++;

    tri.writeUInt8(bu, triOfs);
    triOfs++;
    tri.writeUInt8(bv, triOfs);
    triOfs++;

    tri.writeUInt8(cu, triOfs);
    triOfs++;
    tri.writeUInt8(cv, triOfs);
    triOfs++;

    tri.writeUInt8(0, triOfs);
    triOfs++;
    tri.writeUInt8(0, triOfs);
    triOfs++;

    // Encode the face indices to a dword
    const indexA = a & FACE_MASK;
    const indexB = b & FACE_MASK;
    const indexC = c & FACE_MASK;
    const indexD = 0;

    // Material Index 0 = Img 0 - Palette 0
    // Material Index 1 = Img 0 - Palette 1

    const dword =
      indexA |
      (indexB << 7) |
      (indexC << 14) |
      (indexD << 21) |
      (materialIndex << 28);
    tri.writeUInt32LE(dword, triOfs);
    triOfs += 4;
  }

  const quad = Buffer.alloc(quads.length * 12, 0);
  let quadOfs = 0;
  for (let i = 0; i < quads.length; i++) {
    const f = quads[i].split(" ");

    const [aStr, aIdx] = f[1].split("/");
    const [bStr, bIdx] = f[4].split("/");
    const [cStr, cIdx] = f[2].split("/");
    const [dStr, dIdx] = f[3].split("/");

    // Obj Indices start at 1 not 0
    const a = parseInt(aStr) - 1;
    const b = parseInt(bStr) - 1;
    const c = parseInt(cStr) - 1;
    const d = parseInt(dStr) - 1;

    // Same, Obj Indices start at 1 not 0
    const [au, av] = pixels[parseInt(aIdx) - 1];
    const [bu, bv] = pixels[parseInt(bIdx) - 1];
    const [cu, cv] = pixels[parseInt(cIdx) - 1];
    const [du, dv] = pixels[parseInt(dIdx) - 1];

    quad.writeUInt8(au, quadOfs);
    quadOfs++;
    quad.writeUInt8(av, quadOfs);
    quadOfs++;

    quad.writeUInt8(bu, quadOfs);
    quadOfs++;
    quad.writeUInt8(bv, quadOfs);
    quadOfs++;

    quad.writeUInt8(cu, quadOfs);
    quadOfs++;
    quad.writeUInt8(cv, quadOfs);
    quadOfs++;

    quad.writeUInt8(du, quadOfs);
    quadOfs++;
    quad.writeUInt8(dv, quadOfs);
    quadOfs++;

    // Encode the face indices to a dword
    const indexA = a & FACE_MASK;
    const indexB = b & FACE_MASK;
    const indexC = c & FACE_MASK;
    const indexD = d & FACE_MASK;

    // const materialIndex = 0;

    // Material Index 0 = Img 0 - Palette 0
    // Material Index 1 = Img 0 - Palette 1

    const dword =
      indexA |
      (indexB << 7) |
      (indexC << 14) |
      (indexD << 21) |
      (materialIndex << 28);
    quad.writeUInt32LE(dword, quadOfs);
    quadOfs += 4;
  }

  return {
    tri,
    quad,
    vertices,
  };
};

const encodeMeshWithMaterial = (obj: string): Primitive => {
  const SCALE = 1 / 0.00125;
  const ROT_X = new Matrix4();
  ROT_X.makeRotationX(Math.PI);

  // First step is to break the file down into primitives
  const lines = obj.split("\n");
  const verts: string[] = [];
  const uvs: string[] = [];
  const tris: FaceDef[] = [];
  const quads: FaceDef[] = [];

  let mat = -1;

  lines.forEach((line) => {
    if (line.indexOf("usemtl") === 0) {
      const parts = line.split(" ");
      const m = parts.pop();
      switch (m) {
        case "m0":
          mat = 0;
          break;
        case "m1":
          mat = 1;
          break;
        case "m2":
          mat = 2;
          break;
        case "m3":
          mat = 3;
          break;
      }
    }

    if (line.indexOf("v ") === 0) {
      verts.push(line);
    }

    if (line.indexOf("vt ") === 0) {
      uvs.push(line);
    }

    if (line.indexOf("f ") === 0) {
      const parts = line.split(" ");
      let edge = 0;
      parts.forEach((p) => {
        edge += p.indexOf("/") !== -1 ? 1 : 0;
      });
      switch (edge) {
        case 3:
          tris.push({ mat, line });
          break;
        case 4:
          quads.push({ mat, line });
          break;
        default:
          throw new Error("Wait, what the fuck? " + line);
          break;
      }
    }
  });

  const vertices = Buffer.alloc(verts.length * 4, 0);
  let vertOfs = 0;
  for (let i = 0; i < verts.length; i++) {
    // Extract string values for x,y,z
    const v = verts[i].split(" ");
    const xRaw = parseFloat(v[1]);
    const yRaw = parseFloat(v[2]);
    const zRaw = parseFloat(v[3]);

    // // Scale and rotate to match psx orientation
    const vec3 = new Vector3(xRaw, yRaw, zRaw);
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT_X);
    // vec3.applyMatrix4(ROT_Y);

    // // Round each value to nearest whole int
    vec3.x = Math.round(vec3.x);
    vec3.y = Math.round(vec3.y);
    vec3.z = Math.round(vec3.z);

    // // Encode x,y,z to signed 10 but values
    const { x, y, z } = vec3;

    // Shift and merge vertex to make a 32 bit value
    const vertex = encodeVertex(x, y, z);
    vertices.writeUInt32LE(vertex, vertOfs);
    vertOfs += 4;
  }

  const pixels: [number, number][] = [];

  for (let i = 0; i < uvs.length; i++) {
    // Parse the information from the string
    const uv = uvs[i].split(" ");

    const uRaw = parseFloat(uv[1]);
    // Flip V
    const vRaw = 1 - parseFloat(uv[2]);

    // // Approximate the pixel
    const uAdjusted = uRaw * 255;
    const vAdjusted = vRaw * 255;

    // Eniminate rounding to make sure it's a pixel reference
    // const adjust = debugUV ? 1 : 1
    const uFloor = Math.round(uAdjusted);
    const vFloor = Math.round(vAdjusted + 0.5);

    // // Make sure it fits in one byte
    const u = uFloor > 255 ? 255 : uFloor < 0 ? 0 : uFloor;
    const v = vFloor > 255 ? 255 : vFloor < 0 ? 0 : vFloor;

    // Push the pixels to be referenced
    pixels.push([u, v]);
  }

  // Encode the triangles for each of the faces
  const FACE_MASK = 0x7f;
  const tri = Buffer.alloc(tris.length * 12, 0);
  let triOfs = 0;
  for (let i = 0; i < tris.length; i++) {
    const { mat, line } = tris[i];
    const f = line.split(" ");

    const [aStr, aIdx] = f[2].split("/");
    const [bStr, bIdx] = f[1].split("/");
    const [cStr, cIdx] = f[3].split("/");

    // Obj Indices start at 1 not 0
    const a = parseInt(aStr) - 1;
    const b = parseInt(bStr) - 1;
    const c = parseInt(cStr) - 1;

    // Same, Obj Indices start at 1 not 0
    const [au, av] = pixels[parseInt(aIdx) - 1];
    const [bu, bv] = pixels[parseInt(bIdx) - 1];
    const [cu, cv] = pixels[parseInt(cIdx) - 1];

    tri.writeUInt8(au, triOfs);
    triOfs++;
    tri.writeUInt8(av, triOfs);
    triOfs++;

    tri.writeUInt8(bu, triOfs);
    triOfs++;
    tri.writeUInt8(bv, triOfs);
    triOfs++;

    tri.writeUInt8(cu, triOfs);
    triOfs++;
    tri.writeUInt8(cv, triOfs);
    triOfs++;

    tri.writeUInt8(0, triOfs);
    triOfs++;
    tri.writeUInt8(0, triOfs);
    triOfs++;

    // Encode the face indices to a dword
    const indexA = a & FACE_MASK;
    const indexB = b & FACE_MASK;
    const indexC = c & FACE_MASK;
    const indexD = 0;

    // Material Index 0 = Img 0 - Palette 0
    // Material Index 1 = Img 0 - Palette 1

    const dword =
      indexA | (indexB << 7) | (indexC << 14) | (indexD << 21) | (mat << 28);
    tri.writeUInt32LE(dword, triOfs);
    triOfs += 4;
  }

  const quad = Buffer.alloc(quads.length * 12, 0);
  let quadOfs = 0;
  for (let i = 0; i < quads.length; i++) {
    const { mat, line } = quads[i];
    const f = line.split(" ");

    const [aStr, aIdx] = f[1].split("/");
    const [bStr, bIdx] = f[4].split("/");
    const [cStr, cIdx] = f[2].split("/");
    const [dStr, dIdx] = f[3].split("/");

    // Obj Indices start at 1 not 0
    const a = parseInt(aStr) - 1;
    const b = parseInt(bStr) - 1;
    const c = parseInt(cStr) - 1;
    const d = parseInt(dStr) - 1;

    // Same, Obj Indices start at 1 not 0
    const [au, av] = pixels[parseInt(aIdx) - 1];
    const [bu, bv] = pixels[parseInt(bIdx) - 1];
    const [cu, cv] = pixels[parseInt(cIdx) - 1];
    const [du, dv] = pixels[parseInt(dIdx) - 1];

    quad.writeUInt8(au, quadOfs);
    quadOfs++;
    quad.writeUInt8(av, quadOfs);
    quadOfs++;

    quad.writeUInt8(bu, quadOfs);
    quadOfs++;
    quad.writeUInt8(bv, quadOfs);
    quadOfs++;

    quad.writeUInt8(cu, quadOfs);
    quadOfs++;
    quad.writeUInt8(cv, quadOfs);
    quadOfs++;

    quad.writeUInt8(du, quadOfs);
    quadOfs++;
    quad.writeUInt8(dv, quadOfs);
    quadOfs++;

    // Encode the face indices to a dword
    const indexA = a & FACE_MASK;
    const indexB = b & FACE_MASK;
    const indexC = c & FACE_MASK;
    const indexD = d & FACE_MASK;

    // const materialIndex = 0;

    // Material Index 0 = Img 0 - Palette 0
    // Material Index 1 = Img 0 - Palette 1

    const dword =
      indexA | (indexB << 7) | (indexC << 14) | (indexD << 21) | (mat << 28);
    quad.writeUInt32LE(dword, quadOfs);
    quadOfs += 4;
  }

  return {
    tri,
    quad,
    vertices,
  };
};

const encodeBones = () => {
  const SCALE = 1 / 0.00125;
  const ROT_X = new Matrix4();
  ROT_X.makeRotationX(Math.PI);

  const rollSkeleton = [
    // Root (body)
    {
      x: 0,
      y: 0.953,
      z: 0.014,
    },
    // Head
    {
      x: 0,
      y: 0.345,
      z: -0.021,
    },
    // Right arm - From the shoulder
    {
      x: -0.12,
      y: 0.25,
      z: -0.013,
    },
    // Right elbow
    {
      x: -0.064,
      y: -0.2,
      z: 0,
    },
    // Right hand
    {
      x: 0,
      y: -0.169,
      z: 0,
    },
    // Left arm - From the shoulder (needs adjusts)
    {
      x: 0.12,
      y: 0.25,
      z: -0.013,
    },
    // Left Elbow
    {
      x: 0.064,
      y: -0.2,
      z: 0,
    },
    // Left hand
    {
      x: 0,
      y: -0.169,
      z: 0,
    },
    // Hip Bone
    {
      x: 0,
      y: 0,
      z: 0.019,
    },
    // Right Leg
    {
      x: -0.066,
      y: -0.084,
      z: -0.029,
    },
    // Right Knee
    {
      x: 0,
      y: -0.3, // -0.39
      z: 0,
    },
    // Right Foot
    {
      x: 0,
      y: -0.4, // -0.438
      z: 0,
    },
    // Left Leg
    {
      x: 0.066,
      y: -0.084,
      z: -0.029,
    },
    // Left Knee
    {
      x: 0,
      y: -0.3,
      z: 0,
    },
    // Left Foot
    {
      x: 0,
      y: -0.4,
      z: 0,
    },
    // Zero - use unknown (if any)
    {
      x: 0,
      y: 0,
      z: 0,
    },
  ];

  const vertexSize = 0x06;
  const boneBuffer = Buffer.alloc(rollSkeleton.length * vertexSize);

  let ofs = 0;
  rollSkeleton.forEach((bone) => {
    const vec3 = new Vector3(bone.x, bone.y, bone.z);
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT_X);
    const { x, y, z } = vec3;
    boneBuffer.writeInt16LE(Math.ceil(x), ofs + 0);
    boneBuffer.writeInt16LE(Math.ceil(y), ofs + 2);
    boneBuffer.writeInt16LE(Math.ceil(z), ofs + 4);
    ofs += vertexSize;
  });

  return boneBuffer;
};

const encodeModel = (
  // Filename to replace
  filename: string,
  // Feet
  rightFootObject: string,
  leftFootObject: string,
  // Head
  hairObject: string,
) => {
  // Grab the Source
  const src = readFileSync(`bin/${filename}`);

  // Initialize pack buffer
  const STRIDE = 0x18;
  const mesh = Buffer.alloc(0x2b40, 0);
  const shadowOfs: number[] = [];
  const shadowOfsBk: number[] = [];
  let maxVerts = -1;

  let headerOfs = 0;
  let ptrOfs = 0x2f0;

  const encodeBody = (filename: string, matId = 0) => {
    const obj = readFileSync(filename, "ascii");
    const { tri, quad, vertices } = encodeMesh(obj, matId);

    const triCount = Math.floor(tri.length / 12);
    const quadCount = Math.floor(quad.length / 12);
    const vertCount = Math.floor(vertices.length / 4);
    // Write the number of primites
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts

    // Update the max number of faces to add shadows
    if (vertCount > maxVerts) {
      maxVerts = vertCount;
    }

    // Write Triangles
    const triOfs = ptrOfs;
    mesh.writeUInt32LE(ptrOfs, headerOfs + 4);
    for (let i = 0; i < tri.length; i++) {
      mesh[ptrOfs + i] = tri[i];
    }
    ptrOfs += tri.length;

    // Write Quads
    const quadOfs = ptrOfs;
    mesh.writeUInt32LE(ptrOfs, headerOfs + 8);
    for (let i = 0; i < quad.length; i++) {
      mesh[ptrOfs + i] = quad[i];
    }
    ptrOfs += quad.length;

    // Write Vertices
    const vertOfs = ptrOfs;
    mesh.writeUInt32LE(ptrOfs, headerOfs + 12);
    for (let i = 0; i < vertices.length; i++) {
      mesh[ptrOfs + i] = vertices[i];
    }
    ptrOfs += vertices.length;

    // Push shadows
    shadowOfs.push(headerOfs + 0x10);
    shadowOfsBk.push(headerOfs + 0x14);
    headerOfs += STRIDE;
    return [triCount, quadCount, vertCount, triOfs, quadOfs, vertOfs];
  };

  const encodeFace = () => {
    const dat = src.subarray(0x30, 0x30 + 0x2b40);
    const local = Buffer.from(dat);
    const reader = new ByteReader(local.buffer as ArrayBuffer);

    const HEAD_OFS = 0xb60;
    const names = ["11_FACE", "12_MOUTH"];
    reader.seek(HEAD_OFS + STRIDE);

    names.forEach((name) => {
      const triCount = reader.readUInt8();
      const quadCount = reader.readUInt8();
      const vertCount = reader.readUInt8();
      reader.seekRel(1);

      const triOfs = reader.readUInt32();
      const quadOfs = reader.readUInt32();
      const vertOfs = reader.readUInt32();
      reader.seekRel(0x08);

      // Write the number of primites
      mesh.writeUInt8(triCount, headerOfs + 0); // tris
      mesh.writeUInt8(quadCount, headerOfs + 1); // quads
      mesh.writeUInt8(vertCount, headerOfs + 2); // verts

      const tri = local.subarray(triOfs, triOfs + triCount * 12);
      const quad = local.subarray(quadOfs, quadOfs + quadCount * 12);
      const vertices = local.subarray(vertOfs, vertOfs + vertCount * 4);

      // Update the max number of faces to add shadows
      if (vertCount > maxVerts) {
        maxVerts = vertCount;
      }

      // Write Triangles
      mesh.writeUInt32LE(ptrOfs, headerOfs + 4);
      for (let i = 0; i < tri.length; i++) {
        mesh[ptrOfs + i] = tri[i];
      }
      ptrOfs += tri.length;

      // Write Quads
      mesh.writeUInt32LE(ptrOfs, headerOfs + 8);
      for (let i = 0; i < quad.length; i++) {
        mesh[ptrOfs + i] = quad[i];
      }
      ptrOfs += quad.length;

      // Write Vertices
      mesh.writeUInt32LE(ptrOfs, headerOfs + 12);
      for (let i = 0; i < vertices.length; i++) {
        mesh[ptrOfs + i] = vertices[i];
      }
      ptrOfs += vertices.length;

      // Push shadows
      shadowOfs.push(headerOfs + 0x10);
      shadowOfsBk.push(headerOfs + 0x14);
      headerOfs += STRIDE;
    });
  };

  const encodeBullet = () => {
    const dat = src.subarray(0x30, 0x30 + 0x2b40);
    const local = Buffer.from(dat);
    const reader = new ByteReader(local.buffer as ArrayBuffer);

    const BUSTER_OFS = 0x2220;
    reader.seek(BUSTER_OFS + 2 * STRIDE);

    const triCount = reader.readUInt8();
    const quadCount = reader.readUInt8();
    const vertCount = reader.readUInt8();
    reader.seekRel(1);

    const triOfs = reader.readUInt32();
    const quadOfs = reader.readUInt32();
    const vertOfs = reader.readUInt32();
    reader.seekRel(0x08);

    // Write the number of primites
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts

    const tri = local.subarray(triOfs, triOfs + triCount * 12);
    const quad = local.subarray(quadOfs, quadOfs + quadCount * 12);
    const vertices = local.subarray(vertOfs, vertOfs + vertCount * 4);

    // Update the max number of faces to add shadows
    if (vertCount > maxVerts) {
      maxVerts = vertCount;
    }

    // Write Triangles
    mesh.writeUInt32LE(ptrOfs, headerOfs + 4);
    for (let i = 0; i < tri.length; i++) {
      mesh[ptrOfs + i] = tri[i];
    }
    ptrOfs += tri.length;

    // Write Quads
    mesh.writeUInt32LE(ptrOfs, headerOfs + 8);
    for (let i = 0; i < quad.length; i++) {
      mesh[ptrOfs + i] = quad[i];
    }
    ptrOfs += quad.length;

    // Write Vertices
    mesh.writeUInt32LE(ptrOfs, headerOfs + 12);
    for (let i = 0; i < vertices.length; i++) {
      mesh[ptrOfs + i] = vertices[i];
    }
    ptrOfs += vertices.length;

    // Push shadows
    shadowOfs.push(headerOfs + 0x10);
    shadowOfsBk.push(headerOfs + 0x14);
    headerOfs += STRIDE;
  };

  const encodeShoulder = (shoulder: number[]) => {
    // 1 Write data from shoulder
    const [triCount, quadCount, vertCount, triOfs, quadOfs, vertOfs] = shoulder;
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts

    // Write Triangles, Quads, Verts
    mesh.writeUInt32LE(triOfs, headerOfs + 4);
    mesh.writeUInt32LE(quadOfs, headerOfs + 8);
    mesh.writeUInt32LE(vertOfs, headerOfs + 12);

    // Push shadows
    shadowOfs.push(headerOfs + 0x10);
    shadowOfsBk.push(headerOfs + 0x14);
    headerOfs += STRIDE;
  };

  // Copy the source skeelton into the mesh
  for (let i = 0; i < 0x80; i++) {
    mesh[i] = src[0x30 + i];
  }

  const boneBuffer = encodeBones();
  for (let i = 0; i < boneBuffer.length; i++) {
    mesh[i] = boneBuffer[i];
  }

  // Body Section
  let label = Buffer.from("----  BODY  ----", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x80 + i] = label[i];
  }
  headerOfs = 0x90;
  encodeBody("miku/02_BODY.obj");
  encodeBody("miku/03_HIPS.obj");
  encodeBody("miku/10_LEG_RIGHT_TOP.obj");
  encodeBody("miku/11_LEG_RIGHT_BOTTOM.obj");
  encodeBody("miku/13_LEG_LEFT_TOP.obj");
  encodeBody("miku/14_LEG_LEFT_BOTTOM.obj");

  // Head Section
  label = Buffer.from("----  HEAD  ----", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x120 + i] = label[i];
  }
  headerOfs = 0x130;
  encodeBody(hairObject);
  // encodeFace();
  encodeBody("miku/01_HEAD_FACE.obj", 2);
  encodeBody("miku/01_HEAD_MOUTH.obj", 2);

  // Encode Feet
  label = Buffer.from("----  FEET  ----", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x180 + i] = label[i];
  }
  headerOfs = 0x190;
  encodeBody(rightFootObject);
  encodeBody(leftFootObject);

  // Left Arm
  label = Buffer.from("--  LEFT-ARM  --", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x1c0 + i] = label[i];
  }
  headerOfs = 0x1d0;
  const shoulder = encodeBody("miku/04_RIGHT_SHOULDER.obj");
  encodeBody("miku/05_RIGHT_ARM.obj");
  encodeBody("miku/06_RIGHT_HAND.obj");

  // Right Arm
  label = Buffer.from("--  RIGHT-ARM --", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x220 + i] = label[i];
  }
  headerOfs = 0x230;
  encodeBody("miku/07_LEFT_SHOULDER.obj");
  encodeBody("miku/08_LEFT_ARM.obj");
  encodeBody("miku/09_LEFT_HAND.obj");

  // Buster
  label = Buffer.from("---  BUSTER  ---", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x280 + i] = label[i];
  }
  headerOfs = 0x290;
  encodeShoulder(shoulder);
  encodeBody("miku/41_BUSTER.obj");
  encodeBullet();

  label = Buffer.from("----  PRIM  ----", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[0x2e0 + i] = label[i];
  }

  // Create entry for face shadows
  if (ptrOfs % 16) {
    ptrOfs = Math.ceil(ptrOfs / 16) * 16;
  }

  // Encode the Vertex Colors
  label = Buffer.from("----  VCLR  ----", "ascii");
  for (let i = 0; i < label.length; i++) {
    mesh[ptrOfs++] = label[i];
  }

  const shadows = Buffer.alloc(maxVerts * 4, 0);
  for (let i = 0; i < shadows.length; i += 4) {
    shadows[i + 0] = 0x7c;
    shadows[i + 1] = 0x7c;
    shadows[i + 2] = 0x7c;
    shadows[i + 3] = 0;
  }

  shadowOfs.forEach((ofs) => mesh.writeUint32LE(ptrOfs, ofs));
  for (let i = 0; i < shadows.length; i++) {
    mesh[ptrOfs++] = shadows[i];
  }

  shadowOfsBk.forEach((ofs) => mesh.writeUint32LE(ptrOfs, ofs));
  for (let i = 0; i < shadows.length; i++) {
    mesh[ptrOfs++] = shadows[i];
  }

  if (ptrOfs > 0x2b40) {
    throw new Error("Model length too long " + filename);
  }
  const remaining = 0x2b40 - ptrOfs;
  console.log("Bytes remaining: 0x%s", remaining.toString(16));

  // Copy Over the Model After the Skeleton
  for (let i = 0x0; i < mesh.length; i++) {
    src[i + 0x30] = mesh[i];
  }

  writeFileSync(`out/miku-${filename}`, mesh);
  writeFileSync(`out/${filename}`, src);
};

export { encodeModel, encodeMesh, encodeMeshWithMaterial };
