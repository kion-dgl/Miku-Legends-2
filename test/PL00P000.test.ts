import { test, expect } from "bun:test";
import { readFileSync, writeFileSync } from "fs";
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
    // Feet
    {
      offset: 0x1800,
      names: ["20_NORM_RIGHT_FOOT", "21_NORM_LEFT_FOOT"],
    },
    // Left Arm
    {
      offset: 0x1dd0,
      names: ["30_LEFT_SHOULDER", "31_LEFT_ARM", "32_LEFT_HAND"],
    },
    // Buster
    {
      offset: 0x2220,
      names: ["40_LEFT_SHOULDER", "41_BUSTER", "42_BULLET_MAYBE"],
    },
    // Right Arm
    {
      offset: 0x26f0,
      names: ["50_RIGHT_SHOULDER", "51_RIGHT_ARM", "52_RIGHT_HAND"],
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

      const obj: string[] = [];
      vertices.forEach(({ x, y, z }) => {
        obj.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
      });

      tris.forEach((face) => {
        const [a, b, c] = face;
        obj.push(`f ${a.index + 1} ${b.index + 1} ${c.index + 1}`);
      });

      quads.forEach((face) => {
        const [a, b, c, d] = face;
        obj.push(
          `f ${a.index + 1} ${b.index + 1} ${d.index + 1} ${c.index + 1}`,
        );
      });

      writeFileSync(`./fixtures/${filename}/${name}.OBJ`, obj.join("\n"));
    },
  );
});
