import { readFileSync, writeFileSync } from "fs";
import { Vector3, Matrix4 } from "three";

type Primitive = {
  tri: Buffer;
  quad: Buffer;
  vertices: Buffer;
};

type RawFace = {
  au: number;
  av: number;
  bu: number;
  bv: number;
  cu: number;
  cv: number;
  du: number;
  dv: number;
  isQuad: boolean;
  dword: number;
};

// Function expects a png buffer for the image

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

// Encode the Vertices
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

const encodeDirect = (
  verts: number[],
  tris: RawFace[],
  quads: RawFace[],
): Primitive => {
  const SCALE = 1 / 0.00125;
  const ROT_X = new Matrix4();
  ROT_X.makeRotationX(Math.PI);

  // First step is to break the file down into primitives

  const vertices = Buffer.alloc(verts.length * 4, 0);
  let vertOfs = 0;
  console.log(verts);
  for (let i = 0; i < verts.length; i++) {
    // Extract string values for x,y,z
    vertices.writeUInt32LE(verts[i]);
    vertOfs += 4;
  }

  // Encode the triangles for each of the faces
  const FACE_MASK = 0x7f;
  const tri = Buffer.alloc(tris.length * 12, 0);
  let triOfs = 0;
  console.log(tris);
  for (let i = 0; i < tris.length; i++) {
    const { au, av, bu, bv, cu, cv, dword } = tris[i];

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
    tri.writeUInt32LE(dword, triOfs);
    triOfs += 4;
  }

  console.log(tri);

  const quad = Buffer.alloc(quads.length * 12, 0);
  let quadOfs = 0;
  for (let i = 0; i < quads.length; i++) {
    const { au, av, bu, bv, cu, cv, du, dv, dword } = quads[i];

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
    quad.writeUInt32LE(dword, quadOfs);
    quadOfs += 4;
  }

  return { tri, quad, vertices };
};

const encodeMesh = (obj: string, faceMat: boolean = false): Primitive => {
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

    const materialIndex = faceMat ? 2 : 0;

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

  console.log(tri);

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

  return { tri, quad, vertices };
};

const encodeModelBody = (
  bodyObj: string, // filename
  hipsObj: string, //filename,
  rLegTopObject: string, //filename
  rLegBtmObject: string, // filename
  lLegTopObject: string, // filename
  lLegBtmObject: string, // filename
) => {
  const BODY_START = 0x80;
  const BODY_END = 0xe80;
  const BODY_LEN = BODY_END - BODY_START;

  const prims: Primitive[] = [];
  const limbs = [
    readFileSync(bodyObj, "ascii"),
    readFileSync(hipsObj, "ascii"),
    readFileSync(rLegTopObject, "ascii"),
    readFileSync(rLegBtmObject, "ascii"),
    readFileSync(lLegTopObject, "ascii"),
    readFileSync(lLegBtmObject, "ascii"),
  ];

  const START_OFS = 0x110;
  let shadowPtr = START_OFS;
  for (let i = 0; i < limbs.length; i++) {
    const prim = encodeMesh(limbs[i]);
    const { tri, quad, vertices } = prim;
    prims.push(prim);
    shadowPtr += tri.length;
    shadowPtr += quad.length;
    shadowPtr += vertices.length;
  }

  const mesh = Buffer.alloc(BODY_LEN, 0x80);
  // Need to zero out the header
  for (let i = 0; i < START_OFS; i++) {
    mesh[i] = 0;
  }
  let headerOfs = 0;
  let contentOfs = START_OFS - BODY_START;
  prims.forEach((prim) => {
    const { tri, quad, vertices } = prim;
    const triCount = tri.length / 12;
    const quadCount = quad.length / 12;
    const vertCount = vertices.length / 4;

    console.log("Vert Count: ", vertCount);

    // Write the header for each primitive
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts
    mesh.writeUInt8(0, headerOfs + 3); // nop
    headerOfs += 4;

    // Triangle Definition Offset
    mesh.writeUInt32LE(contentOfs + BODY_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < tri.length; i++) {
      mesh[contentOfs++] = tri[i];
    }

    // Quad Definition Offset
    mesh.writeUInt32LE(contentOfs + BODY_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < quad.length; i++) {
      mesh[contentOfs++] = quad[i];
    }

    // Vertex Definition Offset
    mesh.writeUInt32LE(contentOfs + BODY_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < vertices.length; i++) {
      mesh[contentOfs++] = vertices[i];
    }

    // Triangle Shadow Offset
    mesh.writeUInt32LE(shadowPtr, headerOfs);
    headerOfs += 4;

    // Quad Shadow Offset
    mesh.writeUInt32LE(shadowPtr, headerOfs);
    headerOfs += 4;
  });

  console.log("End Offset: 0x%s", contentOfs.toString(16));
  console.log("Length: 0x%s", BODY_LEN.toString(16));

  return mesh;
};

const encodeModelFeet = (
  rightFoot: string, // filename
  leftFoot: string, //filename,
) => {
  const MESH_START = 0x1a80;
  const MESH_END = 0x1f00;
  const MESH_LEN = MESH_END - MESH_START;

  const prims: Primitive[] = [];
  const limbs = [
    readFileSync(rightFoot, "ascii"),
    readFileSync(leftFoot, "ascii"),
  ];

  const START_OFS = 0x1ab0;
  let shadowPtr = START_OFS;
  for (let i = 0; i < limbs.length; i++) {
    const prim = encodeMesh(limbs[i]);
    const { tri, quad, vertices } = prim;
    prims.push(prim);
    shadowPtr += tri.length;
    shadowPtr += quad.length;
    shadowPtr += vertices.length;
  }

  const mesh = Buffer.alloc(MESH_LEN, 0x80);
  // Need to zero out the header
  for (let i = 0; i < START_OFS; i++) {
    mesh[i] = 0;
  }
  let headerOfs = 0;
  let contentOfs = START_OFS - MESH_START;
  prims.forEach((prim) => {
    const { tri, quad, vertices } = prim;
    const triCount = tri.length / 12;
    const quadCount = quad.length / 12;
    const vertCount = vertices.length / 4;

    console.log("Vert Count: ", vertCount);

    // Write the header for each primitive
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts
    mesh.writeUInt8(0, headerOfs + 3); // nop
    headerOfs += 4;

    // Triangle Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < tri.length; i++) {
      mesh[contentOfs++] = tri[i];
    }

    // Quad Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < quad.length; i++) {
      mesh[contentOfs++] = quad[i];
    }

    // Vertex Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < vertices.length; i++) {
      mesh[contentOfs++] = vertices[i];
    }

    // Triangle Shadow Offset
    mesh.writeUInt32LE(shadowPtr, headerOfs);
    headerOfs += 4;

    // Quad Shadow Offset
    mesh.writeUInt32LE(shadowPtr, headerOfs);
    headerOfs += 4;
  });

  console.log("End Offset: 0x%s", contentOfs.toString(16));
  console.log("Length: 0x%s", MESH_LEN.toString(16));

  return mesh;
};

const encodeModelLeftArm = (m0: string, m1: string, m2: string) => {
  const MESH_START = 0x1f00;
  const MESH_END = 0x2c00;
  const MESH_LEN = MESH_END - MESH_START;

  const prims: Primitive[] = [];
  const limbs = [
    readFileSync(m0, "ascii"),
    readFileSync(m1, "ascii"),
    readFileSync(m2, "ascii"),
  ];

  const START_OFS = 0x1f48;
  let shadowPtr = START_OFS;
  for (let i = 0; i < limbs.length; i++) {
    const prim = encodeMesh(limbs[i]);
    const { tri, quad, vertices } = prim;
    prims.push(prim);
    shadowPtr += tri.length;
    shadowPtr += quad.length;
    shadowPtr += vertices.length;
  }

  const mesh = Buffer.alloc(MESH_LEN, 0x80);
  // Need to zero out the header
  for (let i = 0; i < START_OFS; i++) {
    mesh[i] = 0;
  }
  let headerOfs = 0;
  let contentOfs = START_OFS - MESH_START;
  prims.forEach((prim) => {
    const { tri, quad, vertices } = prim;
    const triCount = tri.length / 12;
    const quadCount = quad.length / 12;
    const vertCount = vertices.length / 4;

    console.log("Vert Count: ", vertCount);

    // Write the header for each primitive
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts
    mesh.writeUInt8(0, headerOfs + 3); // nop
    headerOfs += 4;

    // Triangle Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < tri.length; i++) {
      mesh[contentOfs++] = tri[i];
    }

    // Quad Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < quad.length; i++) {
      mesh[contentOfs++] = quad[i];
    }

    // Vertex Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < vertices.length; i++) {
      mesh[contentOfs++] = vertices[i];
    }

    // Triangle Shadow Offset
    mesh.writeUInt32LE(0x8a8, headerOfs);
    headerOfs += 4;

    // Quad Shadow Offset
    mesh.writeUInt32LE(0x8a8, headerOfs);
    headerOfs += 4;
  });

  console.log("End Offset: 0x%s", contentOfs.toString(16));
  console.log("Length: 0x%s", MESH_LEN.toString(16));

  return mesh;
};

const encodeModelRightArm = (m0: string, m1: string, m2: string) => {
  const MESH_START = 0x2c00;
  const MESH_END = 0x3200;
  const MESH_LEN = MESH_END - MESH_START;

  const prims: Primitive[] = [];
  const limbs = [
    readFileSync(m0, "ascii"),
    readFileSync(m1, "ascii"),
    readFileSync(m2, "ascii"),
  ];

  const START_OFS = 0x1f48;
  let shadowPtr = START_OFS;
  for (let i = 0; i < limbs.length; i++) {
    const prim = encodeMesh(limbs[i]);
    const { tri, quad, vertices } = prim;
    prims.push(prim);
    shadowPtr += tri.length;
    shadowPtr += quad.length;
    shadowPtr += vertices.length;
  }

  const mesh = Buffer.alloc(MESH_LEN, 0x80);
  // Need to zero out the header
  for (let i = 0; i < START_OFS; i++) {
    mesh[i] = 0;
  }
  let headerOfs = 0;
  let contentOfs = START_OFS - MESH_START;
  prims.forEach((prim) => {
    const { tri, quad, vertices } = prim;
    const triCount = tri.length / 12;
    const quadCount = quad.length / 12;
    const vertCount = vertices.length / 4;

    console.log("Vert Count: ", vertCount);

    // Write the header for each primitive
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts
    mesh.writeUInt8(0, headerOfs + 3); // nop
    headerOfs += 4;

    // Triangle Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < tri.length; i++) {
      mesh[contentOfs++] = tri[i];
    }

    // Quad Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < quad.length; i++) {
      mesh[contentOfs++] = quad[i];
    }

    // Vertex Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < vertices.length; i++) {
      mesh[contentOfs++] = vertices[i];
    }

    // Triangle Shadow Offset
    mesh.writeUInt32LE(0x8a8, headerOfs);
    headerOfs += 4;

    // Quad Shadow Offset
    mesh.writeUInt32LE(0x8a8, headerOfs);
    headerOfs += 4;
  });

  console.log("End Offset: 0x%s", contentOfs.toString(16));
  console.log("Length: 0x%s", MESH_LEN.toString(16));

  return mesh;
};

const encodeModelHead = (
  m0: string, // hair
  m1: string, // face
  m2: string, // mouth
) => {
  const MESH_START = 0xe80;
  const MESH_END = 0x1a80;
  const MESH_LEN = MESH_END - MESH_START;

  const prims: Primitive[] = [];
  const limbs = [
    readFileSync(m0, "ascii"),
    readFileSync(m1, "ascii"),
    readFileSync(m2, "ascii"),
  ];

  console.log(limbs[2]);

  const START_OFS = 0xec8;

  // Encode head
  const hd = encodeMesh(limbs[0], false);
  prims.push(hd);

  prims.push({
    vertices: Buffer.from(
      "5f2cde3ba12fde3bb06faf3b00402f39b5a32f3b4ba02f3b007c1f380598bf38fb9bbf38001cfe38a6cfce3b5accce3b506caf3b",
      "hex",
    ),
    tri: Buffer.from(
      "01101f1b051f00008a8100e03a2b3d363a360000838301a0072f002f03260000078401a03336382b39360000888101a0201b3f103b1f0000830503e0",
      "hex",
    ),
    quad: Buffer.from(
      "2222201b3a223b1f874181e11e2206221f1b051f08c240e01f1b01101f000002034522a0201b20003f103f0283c402a0",
      "hex",
    ),
  });
  prims.push({
    vertices: Buffer.from(
      "0060003bb5a32f3b4ba02f3b2d14103bd317103b00ec4f390598bf38fb9bbf38",
      "hex",
    ),
    tri: Buffer.from(
      "202b2f2e20360000850100a0102e1f2b1f360000840200a022231f2b1d23000086c201a0",
      "hex",
    ),
    quad: Buffer.from(
      "06231d23102e1f2b8103a1a03a232f2e2223202b8281a1a0",
      "hex",
    ),
  });

  const mesh = Buffer.alloc(MESH_LEN, 0x80);
  // Need to zero out the header
  for (let i = 0; i < START_OFS; i++) {
    mesh[i] = 0;
  }
  let headerOfs = 0;
  let contentOfs = START_OFS - MESH_START;
  prims.forEach((prim) => {
    const { tri, quad, vertices } = prim;
    const triCount = tri.length / 12;
    const quadCount = quad.length / 12;
    const vertCount = vertices.length / 4;

    console.log("Vert Count: ", vertCount);

    // Write the header for each primitive
    mesh.writeUInt8(triCount, headerOfs + 0); // tris
    mesh.writeUInt8(quadCount, headerOfs + 1); // quads
    mesh.writeUInt8(vertCount, headerOfs + 2); // verts
    mesh.writeUInt8(0, headerOfs + 3); // nop
    headerOfs += 4;

    // Triangle Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < tri.length; i++) {
      mesh[contentOfs++] = tri[i];
    }

    // Quad Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < quad.length; i++) {
      mesh[contentOfs++] = quad[i];
    }

    // Vertex Definition Offset
    mesh.writeUInt32LE(contentOfs + MESH_START, headerOfs);
    headerOfs += 4;
    for (let i = 0; i < vertices.length; i++) {
      mesh[contentOfs++] = vertices[i];
    }

    // Triangle Shadow Offset
    mesh.writeUInt32LE(0x8a8, headerOfs);
    headerOfs += 4;

    // Quad Shadow Offset
    mesh.writeUInt32LE(0x8a8, headerOfs);
    headerOfs += 4;
  });

  return mesh;
};

const replaceModel = (
  gamefile: Buffer,
  bodyBuffer: Buffer,
  feetBuffer: Buffer,
  leftBuffer: Buffer,
  rightBuffer: Buffer,
  headBuffer: Buffer,
) => {
  const modded = Buffer.from(gamefile);
  const read = gamefile.subarray(0x30);

  let seek = 0xe80;
  for (let i = 0; i < 3; i++) {
    const triCount = read.readUInt8(seek + 0);
    const quadCount = read.readUInt8(seek + 1);
    const vertCount = read.readUInt8(seek + 2);

    console.log(
      "%s %s %s",
      triCount.toString(16),
      quadCount.toString(16),
      vertCount.toString(16),
    );
    const triOfs = read.readUInt32LE(seek + 4);
    console.log("Tris ofs: 0x%s", triOfs.toString(16), i);

    const quadOfs = read.readUInt32LE(seek + 8);
    const vertOfs = read.readUInt32LE(seek + 12);
    seek += 0x18;

    if (i === 0) {
      continue;
    }

    console.log("Reading face: ", i);
    const vertices = read.subarray(vertOfs, vertOfs + vertCount * 4);
    const tri = read.subarray(triOfs, triOfs + triCount * 12);
    const quad = read.subarray(quadOfs, quadOfs + quadCount * 12);

    const prim: Primitive = {
      vertices,
      tri,
      quad,
    };
  }

  // Zero out the entire model
  for (let i = 0xb0; i < 0x31f0; i++) {
    modded[i] = 0;
  }

  const BIN_HEADER_SIZE = 0x30;

  // Replace with our updated model
  const bodyOfs = 0x0080 + BIN_HEADER_SIZE;
  for (let i = 0; i < bodyBuffer.length; i++) {
    modded[bodyOfs + i] = bodyBuffer[i];
  }

  const headOfs = 0xe80 + BIN_HEADER_SIZE;
  for (let i = 0; i < headBuffer.length; i++) {
    modded[headOfs + i] = headBuffer[i];
  }

  const feetOfs = 0x1a80 + BIN_HEADER_SIZE;
  for (let i = 0; i < feetBuffer.length; i++) {
    modded[feetOfs + i] = feetBuffer[i];
  }

  const leftOfs = 0x1f00 + BIN_HEADER_SIZE;
  for (let i = 0; i < leftBuffer.length; i++) {
    modded[leftOfs + i] = leftBuffer[i];
  }

  const rightOfs = 0x2c00 + BIN_HEADER_SIZE;
  for (let i = 0; i < leftBuffer.length; i++) {
    modded[rightOfs + i] = rightBuffer[i];
  }

  return modded;
};

const encodeModel = (
  // Filename to replace
  filename: string,
  // Feet
  rightFootObject: string,
  leftFootObject: string,
  // Left Arm

  // Head
  hairObject: string,
) => {
  // Body Section
  const bodyObject = "obj/02_BODY.obj";
  const hipsObject = "obj/03_HIPS.obj";
  const rLegTopObject = "obj/10_LEG_RIGHT_TOP.obj";
  const rLegBtmObject = "obj/11_LEG_RIGHT_BOTTOM.obj";
  const lLegTopObject = "obj/13_LEG_LEFT_TOP.obj";
  const lLegBtmObject = "obj/14_LEG_LEFT_BOTTOM.obj";

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

  // Encode the body
  const srcModel = readFileSync(`bin/${filename}`);
  const body = encodeModelBody(
    bodyObject,
    hipsObject,
    rLegTopObject,
    rLegBtmObject,
    lLegTopObject,
    lLegBtmObject,
  );
  const feet = encodeModelFeet(rightFootObject, leftFootObject);
  const lArm = encodeModelLeftArm(leftShoulder, leftArm, leftHand);
  const rArm = encodeModelRightArm(rightShoulder, rightArm, rightHand);
  const head = encodeModelHead(hairObject, eyesObject, mouthObject);
  const updatedModel = replaceModel(srcModel, body, feet, lArm, rArm, head);
  writeFileSync(`mod/${filename}`, updatedModel.subarray(0x30, 0x1f00 + 0x30));
};

export { encodeModel };
