import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import {
  type MeshHeader,
  readStrips,
  readVertexList,
  readFace,
} from "../src/MeshReader";

import ByteReader from "../src/ByteReader";

test("It should encode an obj with helmet and normal shoes", () => {
  const filename = "PL00P000";
  const file = readFileSync(`./bin/${filename}.BIN`);
  const dat = file.subarray(0x30, 0x30 + 0x2b40);
  const { buffer } = Buffer.from(dat);
  const reader = new ByteReader(buffer as ArrayBuffer);

  const LIMBS = [
    // Body
    {
      offset: 0x80,
      names: [
        "00_BODY",
        "01_HIP",
        "02_LEG_RIGHT_TOP",
        "03_LEG_RIGHT_BOTTOM",
        "04_LEG_LEFT_TOP",
        "05_LEG_LEFT_BOTTOM",
      ],
    },
    // Head
    {
      offset: 0xb60,
      names: ["10_HELMET", "11_FACE", "12_MOUTH"],
    },

    // End Limbs
  ];

  const strips: MeshHeader[] = [];

  // Goto each limb offset
  LIMBS.forEach(({ offset, names }) => {
    readStrips(reader, offset, names).forEach((s) => {
      strips.push(s);
    });
  });

  strips.forEach(
    ({ name, triCount, quadCount, vertCount, triOfs, quadOfs, vertOfs }) => {
      const vertices = readVertexList(reader, vertOfs, vertCount);
      const tris = readFace(reader, triOfs, triCount, false);
      const quads = readFace(reader, quadOfs, quadCount, true);
    },
  );
});
