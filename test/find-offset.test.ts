/**

  Miku-Legends-2
  Copyright (C) 2024, DashGL Project
  By Kion (kion@dashgl.com)

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import { test, expect } from "bun:test";
import { findFileOffset, findPointerTable } from "../src/EncodeRom";
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

  const rom = readFileSync(binFilePath);
  const pointerOfs = findPointerTable(rom);
  expect(pointerOfs).not.toEqual(-1);
});
