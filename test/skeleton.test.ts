import { test, expect } from "bun:test";
import { readFileSync } from "fs";

import megamanSkeleton from "../fixtures/megamanSkeleton.json";
import rollSkeleton from "../fixtures/rollSkeleton.json";
import ByteReader from "../src/ByteReader";
const SCALE = 0.00125;
const ROT = new Matrix4();
ROT.makeRotationX(Math.PI);

type Vector = {
  x: number;
  y: number;
  z: number;
};

import { Vector3, Matrix4 } from "three";

test("reading the MegaMan skeleton", () => {
  const file = readFileSync(`./bin/PL00P000.BIN`);
  const dat = file.subarray(0x30, 0x30 + 0x2b40);
  const { buffer } = Buffer.from(dat);
  const reader = new ByteReader(buffer as ArrayBuffer);

  const bones: Vector[] = [];

  for (let i = 0; i < 16; i++) {
    const xRaw = reader.readInt16();
    const yRaw = reader.readInt16();
    const zRaw = reader.readInt16();

    const vec3 = new Vector3(xRaw, yRaw, zRaw);
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT);
    const { x, y, z } = vec3;

    const xAdjust = parseFloat((Math.abs(x) < 0.01 ? 0 : x).toFixed(3));
    const yAdjust = parseFloat((Math.abs(y) < 0.01 ? 0 : y).toFixed(3));
    const zAdjust = parseFloat((Math.abs(z) < 0.01 ? 0 : z).toFixed(3));
    bones.push({ x: xAdjust, y: yAdjust, z: zAdjust });
  }

  expect(bones).toEqual(megamanSkeleton);
});

test("reading the Roll skeleton", () => {
  const file = readFileSync(`./bin/PL01P000.BIN`);
  const dat = file.subarray(0x30, 0x30 + 0x2b40);
  const { buffer } = Buffer.from(dat);
  const reader = new ByteReader(buffer as ArrayBuffer);

  const bones: Vector[] = [];

  for (let i = 0; i < 16; i++) {
    const xRaw = reader.readInt16();
    const yRaw = reader.readInt16();
    const zRaw = reader.readInt16();

    const vec3 = new Vector3(xRaw, yRaw, zRaw);
    vec3.multiplyScalar(SCALE);
    vec3.applyMatrix4(ROT);
    const { x, y, z } = vec3;
    const xAdjust = parseFloat((Math.abs(x) < 0.01 ? 0 : x).toFixed(3));
    const yAdjust = parseFloat((Math.abs(y) < 0.01 ? 0 : y).toFixed(3));
    const zAdjust = parseFloat((Math.abs(z) < 0.01 ? 0 : z).toFixed(3));
    bones.push({ x: xAdjust, y: yAdjust, z: zAdjust });
  }

  expect(bones).toEqual(rollSkeleton);
});
