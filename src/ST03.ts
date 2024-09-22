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
import { packMesh } from "./ST0305";
import { compressNewSegment, encodeBitfield } from "./EncodeTexture";

type Range = { start: number; end: number };
type Alloc = { ranges: Range[]; contentEnd: number };

const decompressScene = (src: Buffer) => {
  const type = src.readUInt32LE(0);
  const fullSize = src.readUInt32LE(0x04);
  const sectionCount = src.readUInt32LE(0x08);
  const bitfieldSize = src.readUInt16LE(0x10);

  const bitfield: number[] = new Array();
  const target = Buffer.alloc(fullSize + 0x8000);

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

  return target;
};

/**
 * Compress the scene to be able to pack it back into the
 * @param decompressed Buffer for scene to compress
 */
const compressScene = (decompressed: Buffer) => {
  const SEGMENT_LENGTH = 0x2000;
  const segmentCount = Math.ceil(decompressed.length / SEGMENT_LENGTH);
  const segments: Buffer[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(
      decompressed.subarray(i * SEGMENT_LENGTH, (i + 1) * SEGMENT_LENGTH),
    );
  }

  const makeBad = 0;
  const bucket: boolean[] = [];
  const loads: Buffer[] = [];
  segments.forEach((segment, index) => {
    const { bits, outBuffer } = compressNewSegment(segment, makeBad);
    bits.forEach((bit) => bucket.push(bit));
    loads.push(outBuffer);
  });

  const bitfied = encodeBitfield(bucket);
  return [bitfied, Buffer.concat(loads)];
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
  const srcVertEnd = srcVertOfs + srcVertCount * 4;

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

  meta.ranges.push({ start: srcTriOfs, end: srcTriEnd });
  meta.ranges.push({ start: srcQuadOfs, end: srcQuadEnd });
  meta.ranges.push({ start: srcVertOfs, end: srcVertEnd });
};

const repackExistingModel = (src: Buffer) => {
  let writeTo = 0x1e0;
  let doStop = false;
  const vertStack: Buffer[] = [];
  for (let headerOfs = 0xb0; headerOfs < 0x01e0; headerOfs += 0x10) {
    const srcTriCount = src.readUInt8(headerOfs + 0);
    const srcQuadCount = src.readUInt8(headerOfs + 1);
    const srcVertCount = src.readUInt8(headerOfs + 2);

    const srcTriOfs = src.readUInt32LE(headerOfs + 4);
    const srcQuadOfs = src.readUInt32LE(headerOfs + 8);
    const srcVertOfs = src.readUInt32LE(headerOfs + 12);

    const srcTriEnd = srcTriOfs + srcTriCount * 12;
    const srcQuadEnd = srcQuadOfs + srcQuadCount * 12;
    const srcVertEnd = srcVertOfs + srcVertCount * 4;

    const tris = src.subarray(srcTriOfs, srcTriEnd);
    const quads = src.subarray(srcQuadOfs, srcQuadEnd);
    const verts = src.subarray(srcVertOfs, srcVertEnd);

    if (verts.length) {
      vertStack.forEach((vlist) => {
        if (verts.indexOf(vlist) !== -1) {
          console.error("ZOMG WE GOT A HIT!!!!!!!");
          doStop = true;
        }
      });
      vertStack.push(verts);
    }

    src.writeUInt32LE(writeTo, headerOfs + 4);
    for (let i = 0; i < tris.length; i++) {
      src[writeTo++] = tris[i];
    }

    src.writeUInt32LE(writeTo, headerOfs + 8);
    for (let i = 0; i < quads.length; i++) {
      src[writeTo++] = quads[i];
    }

    src.writeUInt32LE(writeTo, headerOfs + 12);
    for (let i = 0; i < verts.length; i++) {
      src[writeTo++] = verts[i];
    }
  }

  console.log("End offset at: 0x%s", writeTo.toString(16));

  // if (doStop) {
  //   process.exit();
  // }
  return writeTo;
};

/**
 * Updates the model for Scene 3 act 0 in the Flutter during the opening cut scene
 */
const updateSceneModel = () => {
  const bin = readFileSync("bin/cut-ST03.BIN");
  const scene3 = Buffer.from(bin.subarray(0xa800));
  let contentEnd = scene3.readUInt32LE(0x04);
  const buffer = decompressScene(scene3);

  console.log(`------------------------------`);
  console.log("Encoding all of the things!!!");
  console.log(`------------------------------`);

  const meta: Alloc = {
    ranges: [],
    contentEnd,
  };
  meta.ranges.sort((a, b) => a.end - a.start - (b.end - b.start));

  // Remove share vertices flag
  const heirarchyOfs = 0x1e14;
  const nbSegments = 19;
  let ofs = heirarchyOfs;
  for (let i = 0; i < nbSegments; i++) {
    const flags = buffer.readUInt8(ofs + 3);
    console.log("%d) 0x%s", i, flags.toString(16));
    buffer.writeUInt8(flags & 0x83, ofs + 3);
    ofs += 4;
  }

  // const start = repackExistingModel(buffer);
  const start = 0x1e0;
  const end = 0x1db8;
  buffer.fill(0, 0xb0, end);
  meta.ranges.push({ start, end });

  // Update Frypan texture
  // const mikuTextureOfs = 0x1e60;
  // const panCoords = buffer.readUInt32LE(0x1e60);
  // const panTextureOfs = 0x4dac;
  // buffer.writeUInt32LE(panCoords, panTextureOfs);

  // Body
  packMesh(buffer, "miku/apron/02_BODY.obj", 0xb0, meta); // 000

  // Hair

  // Right Arm
  packMesh(buffer, "miku/apron/07_RIGHT_SHOULDER.obj", 0xd0, meta); // 002
  packMesh(buffer, "miku/apron/08_RIGHT_ARM.obj", 0xe0, meta); // 002
  packMesh(buffer, "miku/apron/09_RIGHT_HAND.obj", 0xf0, meta); // 003

  // // Left Arm
  packMesh(buffer, "miku/apron/04_LEFT_SHOULDER.obj", 0x100, meta); // 002
  packMesh(buffer, "miku/apron/05_LEFT_ARM.obj", 0x110, meta); // 002
  packMesh(buffer, "miku/apron/06_LEFT_HAND.obj", 0x120, meta); // 003

  // // Hips (dont lie)
  packMesh(buffer, "miku/apron/03_HIPS.obj", 0x130, meta); // 002

  // // Right Leg
  packMesh(buffer, "miku/apron/10_LEG_RIGHT_TOP.obj", 0x140, meta); // 002
  packMesh(buffer, "miku/apron/11_LEG_RIGHT_BOTTOM.obj", 0x150, meta); // 003
  packMesh(buffer, "miku/apron/12_RIGHT_FOOT.obj", 0x160, meta); // 002

  // // Left Leg
  packMesh(buffer, "miku/apron/13_LEG_LEFT_TOP.obj", 0x170, meta); // 002
  packMesh(buffer, "miku/apron/14_LEG_LEFT_BOTTOM.obj", 0x180, meta); // 003
  packMesh(buffer, "miku/apron/15_LEFT_FOOT.obj", 0x190, meta); // 003
  packMesh(buffer, "miku/apron/01_HEAD_FACE.obj", 0x1a0, meta, true); // 015
  packMesh(buffer, "miku/apron/01_HEAD_MOUTH.obj", 0x1b0, meta, true); // 016
  packMesh(buffer, "miku/apron/01_HEAD_HAIR.obj", 0xc0, meta, true); // 001
  packMesh(buffer, "miku/apron/09_RIGHT_HAND_PLATE.obj", 0x1c0, meta); // 017
  packMesh(buffer, "miku/apron/06_LEFT_HAND_PAN.obj", 0x1d0, meta); // 018

  const content = Buffer.from(buffer.subarray(0, meta.contentEnd));
  const [bitField, updatedScene] = compressScene(content);

  bin.writeUInt32LE(meta.contentEnd, 0xa804);
  bin.writeUInt16LE(bitField.length, 0xa810);

  ofs = 0xa830;
  for (let i = 0; i < bitField.length; i++) {
    bin[ofs++] = bitField[i];
  }

  for (let i = 0; i < updatedScene.length; i++) {
    bin[ofs++] = updatedScene[i];
  }

  writeFileSync("out/st03.ebd", buffer);
  writeFileSync("out/st03-content.ebd", content);

  if (ofs < 0x18000 && ofs > 0x17800) {
    console.log("Pack it in, we good to go!!");
  } else {
    throw new Error("Fission mailed!!!! 0x" + ofs.toString(16));
  }

  writeFileSync("out/cut-ST03.BIN", bin);
};

export default updateSceneModel;
export { updateSceneModel };
