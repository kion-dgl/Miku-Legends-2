import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import body from '../fixtures/body.json';

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

test("Reading the strip offsets for the body", () => {

    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const BODY_OFS = 0x80
    const names = ["00_BODY", "01_HIP", "02_LEG_RIGHT_TOP", "03_LEG_RIGHT_BOTTOM", "04_LEG_LEFT_TOP", "05_LEG_LEFT_BOTTOM"];
    reader.seek(BODY_OFS);

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

    expect(meshes).toEqual(body);

});