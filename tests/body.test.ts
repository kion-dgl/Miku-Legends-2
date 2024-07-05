import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import body from '../fixtures/body.json';
import fixtureGeometry from '../fixtures/body-data.json';
import { readStrips, readVertexList, readVertex, readFace } from '../src/MeshReader';
import { encodeVertexBits } from '../src/MeshWriter';


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
            return {x, y, z};
        })

        const triList = readFace(reader, triOfs, triCount, false);
        const quadList = readFace(reader, quadOfs, quadCount, true);
        return  { name, vertices, triList, quadList }
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

        for(let i = 0; i < vertCount; i++) {
            const VERTEX_MASK = 0b1111111111; // 10 bits
            const VERTEX_MSB = 0b1000000000; // bit 9
            const VERTEX_LOW = 0b0111111111; // bits 0 - 8

            const dword = reader.readUInt32();
            const xBytes = (dword >> 0x00) & VERTEX_MASK;
            const yBytes = (dword >> 0x0a) & VERTEX_MASK;
            const zBytes = (dword >> 0x14) & VERTEX_MASK;

            const xHigh = (xBytes & VERTEX_MSB) * -1;
            const xLow = xBytes & VERTEX_LOW;

            const yHigh = (yBytes & VERTEX_MSB) * -1;
            const yLow = yBytes & VERTEX_LOW;

            const zHigh = (zBytes & VERTEX_MSB) * -1;
            const zLow = zBytes & VERTEX_LOW;

            const x = xHigh + xLow
            const y = yHigh + yLow
            const z = zHigh + zLow        
            
            expect(encodeVertexBits(x)).toEqual(xBytes);
            expect(encodeVertexBits(y)).toEqual(yBytes);
            expect(encodeVertexBits(z)).toEqual(zBytes);
            console.log(i, x, xBytes);
        }
    });

});