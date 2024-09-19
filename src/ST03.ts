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
import { packMesh } from "./EncodeApron";
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
    ranges: [
      {
        start: 0x1d0,
        end: 0x1db8,
      },
    ],
    contentEnd,
  };

  // Remove share vertices flag
  const heirarchyOfs = 0x1e14;
  const nbSegments = 19;
  let ofs = heirarchyOfs;
  let doStop = false;
  for (let i = 0; i < nbSegments; i++) {
    const flags = buffer.readUInt8(ofs + 3);
    console.log("%d) 0x%s", i, flags.toString(16));
    buffer.writeUInt8(flags & 0x3, ofs + 3);
    ofs += 4;
  }

  // buffer.fill(0, 0xb0, 0x1db8);

  // // Body
  // packMesh(buffer, "miku/apron/02_BODY.obj", 0xb0, meta); // 000

  // // Hair
  // packMesh(buffer, "miku/apron/01_HEAD_HAIR.obj", 0xc0, meta, true); // 001

  // // Right Arm
  // packMesh(buffer, "miku/apron/07_RIGHT_SHOULDER.obj", 0xd0, meta); // 002
  // packMesh(buffer, "miku/apron/08_RIGHT_ARM.obj", 0xe0, meta); // 002
  // packMesh(buffer, "miku/apron/09_RIGHT_HAND.obj", 0xf0, meta); // 003

  // // Left Arm
  // packMesh(buffer, "miku/apron/04_LEFT_SHOULDER.obj", 0x100, meta); // 002
  // packMesh(buffer, "miku/apron/05_LEFT_ARM.obj", 0x110, meta); // 002
  // packMesh(buffer, "miku/apron/06_LEFT_HAND.obj", 0x120, meta); // 003

  // // Hips (dont lie)
  // packMesh(buffer, "miku/apron/03_HIPS.obj", 0x130, meta); // 002

  // // Right Leg
  // packMesh(buffer, "miku/apron/10_LEG_RIGHT_TOP.obj", 0x140, meta); // 002
  // packMesh(buffer, "miku/apron/11_LEG_RIGHT_BOTTOM.obj", 0x150, meta); // 003
  // packMesh(buffer, "miku/apron/12_RIGHT_FOOT.obj", 0x160, meta); // 002

  // // Left Leg
  // packMesh(buffer, "miku/apron/13_LEG_LEFT_TOP.obj", 0x170, meta); // 002
  // packMesh(buffer, "miku/apron/14_LEG_LEFT_BOTTOM.obj", 0x180, meta); // 003
  // packMesh(buffer, "miku/apron/15_LEFT_FOOT.obj", 0x190, meta); // 003
  // packMesh(buffer, "miku/apron/01_HEAD_FACE.obj", 0x1a0, meta, true); // 015
  // packMesh(buffer, "miku/apron/01_HEAD_MOUTH.obj", 0x1b0, meta, true); // 016
  // packMesh(buffer, "miku/apron/09_RIGHT_HAND_PLATE.obj", 0x1c0, meta); // 017
  // packMesh(buffer, "miku/apron/06_LEFT_HAND_PAN.obj", 0x1d0, meta); // 018

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

  if (ofs < 0x18000 && ofs > 0x17800) {
    console.log("Pack it in, we good to go!!");
  } else {
    throw new Error("Fission mailed!!!! 0x" + ofs.toString(16));
  }

  writeFileSync("out/st03.ebd", buffer);
  writeFileSync("out/cut-ST03.BIN", bin);
};

export default updateSceneModel;
export { updateSceneModel };
