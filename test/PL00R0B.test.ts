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
import { readVertexList, readFace } from "../src/MeshReader";

type MeshHeader = {
  triCount: number;
  quadCount: number;
  vertCount: number;
  triOfs: number;
  quadOfs: number;
  vertOfs: number;
  vertexColorOfs: number;
  vertexColorBkOfs: number;
};

test("it should export an obj of the Shining Laser", () => {
  const filename = "PL00R0B";
  const file = readFileSync(`./bin/wpn_${filename}.BIN`).subarray(0x2000);

  const type = file.readUInt32LE(0x00);
  const length = file.readUInt32LE(0x04);
  const something = file.readUInt32LE(0x08);
  const memory = file.readUInt32LE(0x0c);

  expect(type).toEqual(1);
  expect(length).toEqual(0x6b4);
  expect(something).toEqual(1);
  expect(memory).toEqual(0x80113340);

  const header = file.subarray(0x30);
  const strips: MeshHeader[] = [];

  let ofs = 0;
  const localPointerDiff = 0x2b40;
  for (let i = 0; i < 3; i++) {
    const triCount = header.readUInt8(ofs + 0);
    const quadCount = header.readUInt8(ofs + 1);
    const vertCount = header.readUInt8(ofs + 2);
    const triOfs = header.readUInt32LE(ofs + 0x04) - localPointerDiff;
    const quadOfs = header.readUInt32LE(ofs + 0x08) - localPointerDiff;
    const vertOfs = header.readUInt32LE(ofs + 0x0c) - localPointerDiff;
    const vertexColorOfs = header.readUInt32LE(ofs + 0x10) - localPointerDiff;
    const vertexColorBkOfs = header.readUInt32LE(ofs + 0x14) - localPointerDiff;
    ofs += 0x18;
    strips.push({
      triCount,
      quadCount,
      vertCount,
      triOfs,
      quadOfs,
      vertOfs,
      vertexColorOfs,
      vertexColorBkOfs,
    });
  }
  const { buffer } = Buffer.from(header);
  const reader = new ByteReader(buffer as ArrayBuffer);

  strips.forEach((strip, index) => {
    const { vertCount, vertOfs } = strip;
    const vertexList = readVertexList(reader, vertOfs, vertCount);
    const { triCount, triOfs } = strip;
    const triList = readFace(reader, triOfs, triCount, false);
    const { quadOfs, quadCount } = strip;
    const quadList = readFace(reader, quadOfs, quadCount, true);

    const obj: string[] = [];
    vertexList.forEach(({ x, y, z }) => {
      obj.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    });

    triList.forEach((face) => {
      const [a, b, c] = face;
      obj.push(`f ${a.index + 1} ${b.index + 1} ${c.index + 1}`);
    });

    quadList.forEach((face) => {
      const [a, b, c, d] = face;
      obj.push(`f ${a.index + 1} ${b.index + 1} ${d.index + 1} ${c.index + 1}`);
    });

    const name = index.toString().padStart(3, "0");
    writeFileSync(`./fixtures/${filename}/${name}.OBJ`, obj.join("\n"));
  });

  console.log("Offset: 0x%s", ofs.toString(16));
});
