import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import hair from '../fixtures/hair.json';

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

test("Reading the strip offsets for the hair", () => {

    const buffer = readFileSync(`./bin/PL00P001.BIN`);
    const dat = buffer.subarray(0x30, 0x30 + 0x2b40);
    const reader = new ByteReader(dat.buffer as ArrayBuffer);

    const HEAD_OFS = 0xb60
    const names = ["10_HAIR", "11_FACE", "12_MOUTH"];
    reader.seek(HEAD_OFS);

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

    expect(meshes).toEqual(hair);

});