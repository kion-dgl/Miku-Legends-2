import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import ByteReader from '../src/ByteReader';
import hair from '../fixtures/hair.json';
import { Vector3, Matrix4 } from "three";
import { encodeVertexBits } from "../src/MeshWriter";
import { dwordString } from "../src/MeshReader";
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

test("Reading the strip offsets for the hair", () => {

    const file = readFileSync(`./bin/PL00P001.BIN`);
    const dat = file.subarray(0x30, 0x30 + 0x2b40);
    const { buffer } = Buffer.from(dat);
    const reader = new ByteReader(buffer as ArrayBuffer);

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

