import { readFileSync, writeFileSync } from "fs";
import { Vector3, Matrix4, RGBA_ASTC_12x10_Format } from "three";

type Block = {
  start: number;
  end: number;
  used: number;
};

type PackBuffer = {
  dataOfs: number; // Where to write the offset
  data: Buffer; // The data to be packed
  blockIndex: number; // The block the data is packed
  offset: number; // The offset of the packed data
};

type Combination = {
  buffers: PackBuffer[];
  remainingSpace: number;
};

type Primitive = {
  tri: Buffer;
  quad: Buffer;
  vertices: Buffer;
};

// Start Packing the blocks
const blocks: Block[] = [
  { start: 0x110, end: 0xb60, used: 0 },
  { start: 0xba8, end: 0x1800, used: 0 },
  { start: 0x1830, end: 0x1dd0, used: 0 },
  { start: 0x1e18, end: 0x2220, used: 0 },
  { start: 0x2268, end: 0x26f0, used: 0 },
  { start: 0x2738, end: 0x2b40, used: 0 },
];

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

// Function to generate all combinations of buffers that can fit into a block
function generateCombinations(
  buffers: PackBuffer[],
  remainingSpace: number,
): Combination[] {
  const combinations: Combination[] = [];

  function recurse(
    currentCombination: PackBuffer[],
    startIndex: number,
    spaceLeft: number,
  ) {
    combinations.push({
      buffers: currentCombination,
      remainingSpace: spaceLeft,
    });

    for (let i = startIndex; i < buffers.length; i++) {
      const buffer = buffers[i];
      if (buffer.data.length <= spaceLeft) {
        recurse(
          [...currentCombination, buffer],
          i + 1,
          spaceLeft - buffer.data.length,
        );
      }
    }
  }

  recurse([], 0, remainingSpace);
  return combinations;
}

// Function to pack buffers into blocks using the optimal combination strategy
function packBuffers(buffers: PackBuffer[]): PackBuffer[] {
  // Sort buffers by size in descending order
  const sortedBuffers = [...buffers].sort(
    (a, b) => b.data.length - a.data.length,
  );
  console.log(buffers);

  for (const [blockIndex, block] of blocks.entries()) {
    const blockSize = block.end - block.start + 1;
    const combinations = generateCombinations(sortedBuffers, blockSize);

    // Find the combination with the least remaining space
    const bestCombination = combinations.reduce((best, current) => {
      return current.remainingSpace < best.remainingSpace ? current : best;
    });

    // Allocate the buffers from the best combination
    for (const buffer of bestCombination.buffers) {
      const offset = block.start + block.used;
      buffer.blockIndex = blockIndex;
      buffer.offset = offset;
      block.used += buffer.data.length;

      // Remove the allocated buffer from the sorted list
      const bufferIndex = sortedBuffers.findIndex(
        (b) => b.dataOfs === buffer.dataOfs,
      );
      if (bufferIndex !== -1) {
        sortedBuffers.splice(bufferIndex, 1);
      }
    }
  }

  console.log(buffers);
  return buffers.sort(
    (a, b) => a.blockIndex - b.blockIndex || a.offset - b.offset,
  );
}

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
  const pack: PackBuffer[] = [];
  const mesh = Buffer.alloc(0x2b40, 0);
  const shadowOfs: number[] = [];
  let maxFaces = -1;
  // Body Section
  const BODY_OFS = 0x80;
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
    mesh.writeUInt8(triCount, BODY_OFS + index * STRIDE + 0); // tris
    mesh.writeUInt8(quadCount, BODY_OFS + index * STRIDE + 1); // quads
    mesh.writeUInt8(vertCount, BODY_OFS + index * STRIDE + 2); // verts
    // Update the max number of faces to add shadows
    if (triCount > maxFaces) {
      maxFaces = triCount;
    }
    // Update the max number of faces to add shadows
    if (quadCount > maxFaces) {
      maxFaces = quadCount;
    }

    // Push Tris
    pack.push({
      dataOfs: BODY_OFS + index * STRIDE + 4,
      data: tri,
      blockIndex: -1,
      offset: -1,
    });
    // Push Quads
    pack.push({
      dataOfs: BODY_OFS + index * STRIDE + 8,
      data: quad,
      blockIndex: -1,
      offset: -1,
    });
    // Push Verts
    pack.push({
      dataOfs: BODY_OFS + index * STRIDE + 12,
      data: vertices,
      blockIndex: -1,
      offset: -1,
    });
    // Push shadows
    shadowOfs.push(BODY_OFS + index * STRIDE + 0x10);
    shadowOfs.push(BODY_OFS + index * STRIDE + 0x14);
  });

  // Left Arm
  const leftShoulder = "obj/07_LEFT_SHOULDER.obj";
  const leftArm = "obj/08_LEFT_ARM.obj";
  const leftHand = "obj/09_LEFT_HAND.obj";

  // Right Arm
  const rightShoulder = "obj/04_RIGHT_SHOULDER.obj";
  const rightArm = "obj/05_RIGHT_ARM.obj";
  const rightHand = "obj/06_RIGHT_HAND.obj";

  // Eyes and mouth
  const eyesObject = "obj/01_HEAD_FACE.obj";
  const mouthObject = "obj/01_HEAD_MOUTH.obj";

  // Create entry for face shadows
  pack.push({
    dataOfs: -1,
    data: Buffer.alloc((maxFaces + 4) * 4, 0x80),
    blockIndex: -1,
    offset: -1,
  });

  const packingResult = packBuffers(pack);
  packingResult.forEach((result) => {
    const { dataOfs, data, offset } = result;
    if (dataOfs === -1) {
      shadowOfs.forEach((ofs) => mesh.writeUint32LE(offset, ofs));
    } else {
      mesh.writeUint32LE(offset, dataOfs);
    }
    for (let i = 0; i < data.length; i++) {
      mesh[offset + i] = data[i];
    }
  });

  // Replace in Game File
  const src = readFileSync(`bin/${filename}`);
  for (let i = 0x80; i < mesh.length; i++) {
    src[i + 0x30] = mesh[i];
  }

  // const HEADER_LEN = 0x30;
  // // Zero out body
  // for (let i = 0x98; i < 0x110; i++) {
  //   src[HEADER_LEN + i] = 0;
  // }
  // // Zero out everything else
  // for (let i = 0xb60; i < 0xba8; i++) {
  //   src[HEADER_LEN + i] = 0;
  // }

  // writeFileSync(`out/debug_${filename}`, mesh);
  writeFileSync(`out/${filename}`, src);
};

export { encodeModel };
