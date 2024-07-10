import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import shoesHydro from '../fixtures/shoes-hydro.json'

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

    const file = readFileSync(`./bin/PL00P004.BIN`);
    const dat = file.subarray(0x30, 0x30 + 0x2b40);
    const { buffer } = Buffer.from(dat);
    const reader = new ByteReader(buffer as ArrayBuffer);

    const FEET_OFS = 0x1800
    const names = ["20_HYDRO_RIGHT_FOOT", "21_HYDRO_LEFT_FOOT"];
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

    expect(meshes).toEqual(shoesHydro);
});