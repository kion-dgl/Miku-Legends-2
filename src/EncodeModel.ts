import { readFileSync, writeFileSync } from "fs";
import { Vector3, Matrix4, RGBA_ASTC_12x10_Format } from "three";

type PackBuffer = {
  dataOfs: number; // Where to write the offset
  data: Buffer; // The data to be packed
};

type Primitive = {
  tri: Buffer;
  quad: Buffer;
  vertices: Buffer;
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

const encodeMesh = (obj: string, materialIndex: number): Primitive => {
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

  const PIXEL_TO_FLOAT_RATIO = 0.00390625;
  const PIXEL_ADJUSTMEST = 0.001953125;
  const pixels: [number, number][] = [];

  for (let i = 0; i < uvs.length; i++) {
    // Parse the information from the string
    const uv = uvs[i].split(" ");
    const uRaw = parseFloat(uv[1]);
    // Flip V
    const vRaw = 1 - parseFloat(uv[2]);

    // // Approximate the pixel
    const uAdjusted = uRaw / PIXEL_TO_FLOAT_RATIO - PIXEL_ADJUSTMEST;
    const vAdjusted = vRaw / PIXEL_TO_FLOAT_RATIO - PIXEL_ADJUSTMEST;

    // // Eniminate rounding to make sure it's a pixel reference
    const uFloor = Math.floor(uAdjusted);
    const vFloor = Math.floor(vAdjusted);

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

    const materialIndex = 0;

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

const encodeModel = (
  // Filename to replace
  filename: string,
  // Feet
  rightFootObject: string,
  leftFootObject: string,
  // Head
  hairObject: string,
) => {
  // Initialize pack buffer
  const STRIDE = 0x18;
  const mesh = Buffer.alloc(0x2b40, 0);
  const shadowOfs: number[] = [];
  let maxFaces = -1;

  let headerOfs = 0x80;
  let ptrOfs = 0x260;

  // Body Section
  [
    "miku/02_BODY.obj",
    "miku/03_HIPS.obj",
    "miku/10_LEG_RIGHT_TOP.obj",
    "miku/11_LEG_RIGHT_BOTTOM.obj",
    "miku/13_LEG_LEFT_TOP.obj",
    "miku/14_LEG_LEFT_BOTTOM.obj",
  ].forEach((filename, index) => {
    const obj = readFileSync(filename, "ascii");
    const { tri, quad, vertices } = encodeMesh(obj, 0);

    const triCount = Math.floor(tri.length / 12);
    const quadCount = Math.floor(quad.length / 12);
    const vertCount = Math.floor(vertices.length / 4);
    // Write the number of primites
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts

    // Update the max number of faces to add shadows
    if (triCount > maxFaces) {
      maxFaces = triCount;
    }
    // Update the max number of faces to add shadows
    if (quadCount > maxFaces) {
      maxFaces = quadCount;
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
    shadowOfs.push(headerOfs + 0x14);
    headerOfs += STRIDE;
  });

  // Head Section
  const HEAD_OFS = 0xb60;
  [
    "miku/01_HEAD_HAIR.obj",
    "miku/01_HEAD_FACE.obj",
    "miku/01_HEAD_MOUTH.obj",
  ].forEach((filename, index) => {
    const obj = readFileSync(filename, "ascii");
    const { tri, quad, vertices } = encodeMesh(obj, 0);

    const triCount = Math.floor(tri.length / 12);
    const quadCount = Math.floor(quad.length / 12);
    const vertCount = Math.floor(vertices.length / 4);
    // Write the number of primites
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts

    // Update the max number of faces to add shadows
    if (triCount > maxFaces) {
      maxFaces = triCount;
    }
    // Update the max number of faces to add shadows
    if (quadCount > maxFaces) {
      maxFaces = quadCount;
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
    shadowOfs.push(headerOfs + 0x14);
    headerOfs += STRIDE;
  });

  // Left Arm
  const leftShoulder = "obj/07_LEFT_SHOULDER.obj";
  const leftArm = "obj/08_LEFT_ARM.obj";
  const leftHand = "obj/09_LEFT_HAND.obj";

  // Right Arm
  const rightShoulder = "obj/04_RIGHT_SHOULDER.obj";
  const rightArm = "obj/05_RIGHT_ARM.obj";
  const rightHand = "obj/06_RIGHT_HAND.obj";

  // Create entry for face shadows
  const shadows = Buffer.alloc((maxFaces + 4) * 4, 0x80);
  shadowOfs.forEach((ofs) => mesh.writeUint32LE(ptrOfs, ofs));
  for (let i = 0; i < shadows.length; i++) {
    mesh[ptrOfs + i] = shadows[i];
  }
  ptrOfs += shadows.length;
  if (ptrOfs > 0x2b40) {
    throw new Error("Model length too long " + filename);
  }

  const src = readFileSync(`bin/${filename}`);

  // Copy Over the Model After the Skeleton
  for (let i = 0x80; i < mesh.length; i++) {
    src[i + 0x30] = mesh[i];
  }

  writeFileSync(`out/miku-${filename}`, mesh);
  writeFileSync(`out/${filename}`, src);
};

export { encodeModel };
