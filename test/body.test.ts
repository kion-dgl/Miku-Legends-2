import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import body from '../fixtures/body.json';
import fixtureGeometry from '../fixtures/body-data.json';
import { readStrips, readVertexList, dwordString, readFace } from '../src/MeshReader';
import { encodeVertexBits } from '../src/MeshWriter';
import { Vector3, Matrix4 } from "three";
const SCALE = 0.00125;
const RESTORE = 800;
const ROT = new Matrix4();
ROT.makeRotationX(Math.PI);

test("Reading the strip offsets for the body", () => {
    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const BODY_OFS = 0xb0
    const names = ["00_BODY", "01_HIP", "02_LEG_RIGHT_TOP", "03_LEG_RIGHT_BOTTOM", "04_LEG_LEFT_TOP", "05_LEG_LEFT_BOTTOM"];
    const strips = readStrips(reader, BODY_OFS, names);
    expect(strips).toEqual(body);

});

test("Reading the vertex and face data for the body", () => {
    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const geometry = body.map((mesh) => {
        const { name, vertOfs, vertCount, triOfs, triCount, quadOfs, quadCount } = mesh;
        const vertexList = readVertexList(reader, vertOfs, vertCount);
        const vertices = vertexList.map((v) => {
            const { x, y, z } = v;
            return { x, y, z };
        })

        const triList = readFace(reader, triOfs, triCount, false);
        const quadList = readFace(reader, quadOfs, quadCount, true);
        return { name, vertices, triList, quadList }
    });

    expect(geometry).toEqual(fixtureGeometry);
});



test('Re-encoding the vertices read from the body', () => {
    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    body.map((mesh) => {
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

test('Re-encoding the tris read from the body', () => {
    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const FACE_MASK = 0x7f;
    const PIXEL_TO_FLOAT_RATIO = 0.00390625;
    const PIXEL_ADJUSTMEST = 0.001953125;

    body.map((mesh) => {
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


test('Re-encoding the quad read from the body', () => {
    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const FACE_MASK = 0x7f;
    const PIXEL_TO_FLOAT_RATIO = 0.00390625;
    const PIXEL_ADJUSTMEST = 0.001953125;

    body.map((mesh) => {
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

            expect(indexA | (indexB << 7) | (indexC << 14) | (indexD << 21) | (materialIndex << 28)).toEqual(dword);
        }

    });
});
