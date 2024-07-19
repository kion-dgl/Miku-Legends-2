import { test, expect } from "bun:test";
import { findFileOffset } from "../src/EncodeRom";
import { readFileSync } from "fs";

test("ISO 9660 File Offset Finder", () => {
  const testFiles = [
    "PL00P000.BIN",
    "PL00P001.BIN",
    "PL00P002.BIN",
    "PL00P003.BIN",
    "PL00P004.BIN",
    "PL00P005.BIN",
    "PL00P010.BIN",
    "PL00P011.BIN",
    "PL00P012.BIN",
    "PL00P013.BIN",
    "PL00P014.BIN",
    "PL00P015.BIN",
  ];

  const binFilePath = process.env.SRC_ROM;
  if (!binFilePath) {
    console.log("SRC_ROM environment variable not set. Skipping tests.");
    return;
  }

  const rom = readFileSync(binFilePath);

  testFiles.forEach((filename) => {
    const file = readFileSync(`bin/${filename}`);
    const fileOffset = findFileOffset(rom, file);
    expect(fileOffset).not.toEqual(-1);
  });
});

test("Megaman Model Offset Reference", () => {
  const binFilePath = process.env.SRC_ROM;
  if (!binFilePath) {
    console.log("SRC_ROM environment variable not set. Skipping tests.");
    return;
  }

  const PLAYER_OFFSET = 0x110800;
  const body = 0x80;
  const head = 0xb60;
  const rightArm = 0x26f0;
  const eof = 0x2b40;
  const leftArm = 0x1dd0;
  const buster = 0x2220;
  const feet = 0x1800;

  const rom = readFileSync(binFilePath);

  let found = false;
  let ofs = -1;
  for (let i = 0; i < rom.length - 0x20; i += 4) {
    const a = (rom.readUInt32LE(i + 0) & 0xffffff) - PLAYER_OFFSET;
    const b = (rom.readUInt32LE(i + 4) & 0xffffff) - PLAYER_OFFSET;
    const c = (rom.readUInt32LE(i + 8) & 0xffffff) - PLAYER_OFFSET;
    const d = (rom.readUInt32LE(i + 12) & 0xffffff) - PLAYER_OFFSET;
    const e = (rom.readUInt32LE(i + 16) & 0xffffff) - PLAYER_OFFSET;
    const f = (rom.readUInt32LE(i + 20) & 0xffffff) - PLAYER_OFFSET;
    const g = (rom.readUInt32LE(i + 24) & 0xffffff) - PLAYER_OFFSET;

    if (a !== body) {
      continue;
    }

    if (b !== head) {
      continue;
    }

    if (c !== rightArm) {
      continue;
    }

    if (d !== eof) {
      continue;
    }

    if (e !== leftArm) {
      continue;
    }

    if (f !== buster) {
      continue;
    }

    if (g !== feet) {
      continue;
    }

    found = true;
    console.log("Offset found at 0x%s", i.toString(16));
    break;
  }

  expect(found).toBeTrue();
});
