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
import { readFileSync } from "fs";

const files = [
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

test("Reading the header for the model bin files", () => {
    files.forEach((file) => {
        const buffer = readFileSync(`./bin/${file}`);
        // Type
        expect(buffer.readUInt32LE(0)).toBe(1);
        // Length
        expect(buffer.readUInt32LE(4)).toBe(0x2b40);
        // Unknown
        expect(buffer.readUInt32LE(8)).toBe(6);
        // Memory Offset
        expect(buffer.readUInt32LE(12)).toBe(0x80110800);
    });
});