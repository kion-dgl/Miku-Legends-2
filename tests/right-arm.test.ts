import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import rightArm from '../fixtures/right-arm.json';

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

test("dat reader", () => {

    const buffer = readFileSync(`./bin/PL00P000.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const RIGHT_ARM_OFS = 0x1dd0
    const names = ["30_RIGHT_SHOULDER", "31_RIGHT_ARM", "32_RIGHT_HAND"];
    reader.seek(RIGHT_ARM_OFS);

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

    console.log(JSON.stringify(meshes, null, 2));
    expect(meshes).toEqual(rightArm);

});