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
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import shoesJet from '../fixtures/shoes-jet.json';
import { Vector3, Matrix4 } from "three";
import { dwordString } from "../src/MeshReader";
import { encodeVertexBits } from "../src/MeshWriter";
const SCALE = 0.00125;
const RESTORE = 800;
const ROT = new Matrix4();
ROT.makeRotationX(Math.PI);

type MeshHeader = {
    name: string;
    triCount: number;
    quadCount: number;
    vertCount: number;
    triOfs: number;
    quadOfs: number;
    vertOfs: number;
    triShadowOfs: number;
    quadShadowOfs: number;
}

test("Reading the strip offsets for the shoes", () => {

    const file = readFileSync(`./bin/PL00P001.BIN`);
    const dat = file.subarray(0x30, 0x30 + 0x2b40);
    const { buffer } = Buffer.from(dat);
    const reader = new ByteReader(buffer as ArrayBuffer);

    const FEET_OFS = 0x1800
    const names = ["20_JET_RIGHT_FOOT", "21_JET_LEFT_FOOT"];
    reader.seek(FEET_OFS);

    const meshes: MeshHeader[] = [];
    names.forEach((name) => {

        const triCount = reader.readUInt8();
        const quadCount = reader.readUInt8();
        const vertCount = reader.readUInt8();
        reader.seekRel(1);

        const triOfs = reader.readUInt32();
        const quadOfs = reader.readUInt32();
        const vertOfs = reader.readUInt32();
        const triShadowOfs = reader.readUInt32();
        const quadShadowOfs = reader.readUInt32();

        meshes.push({
            name,
            triCount,
            quadCount,
            vertCount,
            triOfs,
            quadOfs,
            vertOfs,
            triShadowOfs,
            quadShadowOfs
        })
    });

    expect(meshes).toEqual(shoesJet);

});

test('Re-encoding the vertices read from the shoes(jet)', () => {
    const file = readFileSync(`./bin/PL00P001.BIN`);
    const dat = file.subarray(0x30, 0x30 + 0x2b40);
    const { buffer } = Buffer.from(dat);
    const reader = new ByteReader(buffer as ArrayBuffer);

    shoesJet.map((mesh) => {
        const { vertOfs, vertCount } = mesh;
        reader.seek(vertOfs);

        for (let i = 0; i < vertCount; i++) {
            const VERTEX_MASK = 0x3ff; // 10 bits
            const VERTEX_MSB = 0x200; // bit 9
            const VERTEX_LOW = 0x1ff; // bits 0 - 8
            const dwords = new Uint32Array(2);

            // Read the vertex data
            const dword = reader.readUInt32();
            dwords[0] = dword;
            const xBytes = (dword >> 0x00) & VERTEX_MASK;
            const yBytes = (dword >> 0x0a) & VERTEX_MASK;
            const zBytes = (dword >> 0x14) & VERTEX_MASK;

            // Decode the vertex data
            const xHigh = (xBytes & VERTEX_MSB) * -1;
            const xLow = xBytes & VERTEX_LOW;

            const yHigh = (yBytes & VERTEX_MSB) * -1;
            const yLow = yBytes & VERTEX_LOW;

            const zHigh = (zBytes & VERTEX_MSB) * -1;
            const zLow = zBytes & VERTEX_LOW;

            const x = xHigh + xLow
            const y = yHigh + yLow
            const z = zHigh + zLow

            const vec3 = new Vector3(x, y, z);
            vec3.multiplyScalar(SCALE);
            vec3.applyMatrix4(ROT);

            // Encode the vertex data
            const v = vec3.clone();
            v.applyMatrix4(ROT);
            v.multiplyScalar(RESTORE);
            v.x = Math.round(v.x)
            v.y = Math.round(v.y)
            v.z = Math.round(v.z)
            v.x === -0 ? v.x = 0 : v.x = v.x;
            v.y === -0 ? v.y = 0 : v.y = v.y;
            v.z === -0 ? v.z = 0 : v.z = v.z;

            const encodedx = encodeVertexBits(v.x);
            const encodedy = encodeVertexBits(v.y);
            const encodedz = encodeVertexBits(v.z);

            // Check that the re-encoded vertex data matches the original
            expect(encodedx).toEqual(xBytes);
            expect(encodedy).toEqual(yBytes);
            expect(encodedz).toEqual(zBytes);

            // Check that the re-encoded vertex data matches the original
            dwords[1] = encodedx | (encodedy << 0x0a) | (encodedz << 0x14)
            expect(dwordString(dwords[1])).toEqual(dwordString(dwords[0]));
        }
    });

});

test('Re-encoding the tris read from the shoes(jet)', () => {
    const file = readFileSync(`./bin/PL00P001.BIN`);
    const dat = file.subarray(0x30, 0x30 + 0x2b40);
    const { buffer } = Buffer.from(dat);
    const reader = new ByteReader(buffer as ArrayBuffer);


    const FACE_MASK = 0x7f;
    const PIXEL_TO_FLOAT_RATIO = 0.00390625;
    const PIXEL_ADJUSTMEST = 0.001953125;

    shoesJet.map((mesh) => {
        const { triOfs, triCount } = mesh;
        reader.seek(triOfs)
        for (let i = 0; i < triCount; i++) {
            const au = reader.readUInt8();
            const av = reader.readUInt8();
            const bu = reader.readUInt8();
            const bv = reader.readUInt8();
            const cu = reader.readUInt8();
            const cv = reader.readUInt8();
            reader.seekRel(2);

            const dword = reader.readUInt32();
            const materialIndex = ((dword >> 28) & 0x3);

            const indexA = (dword >> 0x00) & FACE_MASK;
            const indexB = (dword >> 0x07) & FACE_MASK;
            const indexC = (dword >> 0x0e) & FACE_MASK;

            const a = {
                materialIndex,
                index: indexA,
                u: au * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: av * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }

            const b = {
                materialIndex,
                index: indexB,
                u: bu * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: bv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }
            const c = {
                materialIndex,
                index: indexC,
                u: cu * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: cv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }

            expect(Math.floor((a.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(au);
            expect(Math.floor((a.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(av);
            expect(Math.floor((b.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(bu);
            expect(Math.floor((b.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(bv);
            expect(Math.floor((c.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(cu);
            expect(Math.floor((c.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(cv);
            expect(indexA | (indexB << 7) | (indexC << 14) | (materialIndex << 28)).toEqual(dword);
        }

    });
});


test('Re-encoding the quad read from the shoes(jet)', () => {
    const file = readFileSync(`./bin/PL00P001.BIN`);
    const dat = file.subarray(0x30, 0x30 + 0x2b40);
    const { buffer } = Buffer.from(dat);
    const reader = new ByteReader(buffer as ArrayBuffer);

    const FACE_MASK = 0x7f;
    const PIXEL_TO_FLOAT_RATIO = 0.00390625;
    const PIXEL_ADJUSTMEST = 0.001953125;

    shoesJet.map((mesh) => {
        const { quadOfs, quadCount } = mesh;
        reader.seek(quadOfs)
        for (let i = 0; i < quadCount; i++) {
            const au = reader.readUInt8();
            const av = reader.readUInt8();
            const bu = reader.readUInt8();
            const bv = reader.readUInt8();
            const cu = reader.readUInt8();
            const cv = reader.readUInt8();
            const du = reader.readUInt8();
            const dv = reader.readUInt8();
            
            const dword = reader.readUInt32();
            const materialIndex = ((dword >> 28) & 0x3);

            const indexA = dword & FACE_MASK;
            const indexB = (dword >> 7) & FACE_MASK;
            const indexC = (dword >> 14) & FACE_MASK;
            const indexD = (dword >> 21) & FACE_MASK;

            const a = {
                materialIndex,
                index: indexA,
                u: au * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: av * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }

            const b = {
                materialIndex,
                index: indexB,
                u: bu * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: bv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }

            const c = {
                materialIndex,
                index: indexC,
                u: cu * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: cv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }

            const d = {
                materialIndex,
                index: indexC,
                u: du * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
                v: dv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            }

            expect(Math.floor((a.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(au);
            expect(Math.floor((a.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(av);
            expect(Math.floor((b.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(bu);
            expect(Math.floor((b.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(bv);
            expect(Math.floor((c.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(cu);
            expect(Math.floor((c.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(cv);
            expect(Math.floor((d.u - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(du);
            expect(Math.floor((d.v - PIXEL_ADJUSTMEST) / PIXEL_TO_FLOAT_RATIO)).toEqual(dv);

            expect(indexA | (indexB << 7) | (indexC << 14) | (indexD << 21) | (materialIndex << 28)).toEqual(dword & 0x3fffffff);
        }

    });
});
