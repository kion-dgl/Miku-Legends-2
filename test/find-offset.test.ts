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
