import { file } from "bun";
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

test("dat reader", () => {
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