import { test, expect } from "bun:test";
import { encodeImage } from "../src/EncodeTexture";
import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";

type Pixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const wordToColor = (word: number): Pixel => {
  const r = ((word >> 0x00) & 0x1f) << 3;
  const g = ((word >> 0x05) & 0x1f) << 3;
  const b = ((word >> 0x0a) & 0x1f) << 3;
  const a = word > 0 ? 255 : 0;
  return { r, g, b, a };
};

test("it should encode and render an image", () => {
  const src = readFileSync("miku/body-1.png");
  const [pal, img] = encodeImage(src);

  const palette: Pixel[] = new Array();
  for (let i = 0; i < 16; i++) {
    const word = pal.readUInt16LE(i * 2);
    palette.push(wordToColor(word));
  }

  // Read the image data
  const imageData: number[] = new Array();
  for (let ofs = 0; ofs < img.length; ofs++) {
    const byte = img.readUInt8(ofs);
    imageData.push(byte & 0xf);
    imageData.push(byte >> 4);
  }

  const width = 256;
  const height = 256;
  const png = new PNG({ width, height });

  let index = 0;
  let dst = 0;
  for (let y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      const colorIndex = imageData[index++];
      const { r, g, b, a } = palette[colorIndex!];
      png.data[dst++] = r;
      png.data[dst++] = g;
      png.data[dst++] = b;
      png.data[dst++] = a;
    }
  }

  // Export file
  const buffer = PNG.sync.write(png);
  writeFileSync("fixtures/0-miku-body.png", buffer);
});
