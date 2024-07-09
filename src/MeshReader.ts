import { Vector3, Matrix4 } from "three";
import type ByteReader from "./ByteReader";
const SCALE = 0.00125;
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


const dwordString = (dword: number) => {
    const str = dword.toString(2).padStart(32, '0');
    return `00-${str.slice(2, 12)}-${str.slice(12 - 22)}-${str.slice(22, 32)}`;
}

const readStrips = (
    reader: ByteReader,
    stripOfs: number,
    names: string[],
) => {
    reader.seek(stripOfs);
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

    return meshes;
}

const readVertex = (
    reader: ByteReader,
) => {
    const VERTEX_MASK = 0b1111111111;
    const VERTEX_MSB = 0b1000000000;
    const VERTEX_LOW = 0b0111111111;

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

    const vec3 = new Vector3(
        (xHigh + xLow),
        (yHigh + yLow),
        (zHigh + zLow)
    );
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT);

    const { x, y, z } = vec3;
    return { x, y, z, dword };
}

const readVertexList = (
    reader: ByteReader,
    vertexOfs: number,
    vertexCount: number
) => {
    const VERTEX_MASK = 0b1111111111;
    const VERTEX_MSB = 0b1000000000;
    const VERTEX_LOW = 0b0111111111;
    const localIndices: Vector3[] = [];

    reader.seek(vertexOfs)
    for (let i = 0; i < vertexCount; i++) {
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

        const vec3 = new Vector3(
            (xHigh + xLow),
            (yHigh + yLow),
            (zHigh + zLow)
        );
        vec3.multiplyScalar(SCALE);
        vec3.applyMatrix4(ROT);
        localIndices.push(vec3);
    }

    return localIndices;
}

const readFace = (
    reader: ByteReader,
    faceOfs: number,
    faceCount: number,
    isQuad: boolean
) => {
    const FACE_MASK = 0x7f;
    const PIXEL_TO_FLOAT_RATIO = 0.00390625;
    const PIXEL_ADJUSTMEST = 0.001953125;

    reader.seek(faceOfs)
    for (let i = 0; i < faceCount; i++) {
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

        const indexA = (dword >> 0x00) & FACE_MASK;
        const indexB = (dword >> 0x07) & FACE_MASK;
        const indexC = (dword >> 0x0e) & FACE_MASK;
        const indexD = (dword >> 0x15) & FACE_MASK;

        const a = {
            materialIndex,
            index: indexA,
            u: au * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            v: av * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
        };

        const b = {
            materialIndex,
            index: indexB,
            u: bu * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            v: bv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
        };

        const c = {
            materialIndex,
            index: indexC,
            u: cu * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            v: cv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
        };

        const d = {
            materialIndex,
            index: indexD,
            u: du * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
            v: dv * PIXEL_TO_FLOAT_RATIO + PIXEL_ADJUSTMEST,
        };

        return isQuad ? [a, b, c, d] : [a, b, c];
    }
}

export { readStrips, readVertexList, readFace, readVertex, dwordString }