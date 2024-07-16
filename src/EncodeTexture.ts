import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";

const encodeTexel = (r: number, g: number, b: number, a: number) => {
  const rClr = Math.floor((r >> 3) & 0xff);
  const gClr = Math.floor((g >> 3) & 0xff);
  const bClr = Math.floor((b >> 3) & 0xff);
  const aClr = a === 0 ? 0 : 0x8000;
  const texel = rClr | (gClr << 5) | (bClr << 10) | aClr;
  return texel;
};

const readPixel = (data: Buffer, inOfs: number, pal: number[]) => {
  const a = data.readUInt8(inOfs + 3) === 0 ? 0 : 255;
  const r = a === 0 ? 0 : data.readUInt8(inOfs + 0);
  const g = a === 0 ? 0 : data.readUInt8(inOfs + 1);
  const b = a === 0 ? 0 : data.readUInt8(inOfs + 2);
  const texel = encodeTexel(r, g, b, a);

  // Search through the existing palette
  const index = pal.indexOf(texel);

  // If doesn't exist, we add it to the palette
  if (index === -1) {
    const pos = pal.length;
    pal.push(texel);
    return pos;
  }

  return index;
};

const encodeImage = (pngSrc: Buffer) => {
  const pngInfo = PNG.sync.read(pngSrc);
  const { width, height, data } = pngInfo;

  if (width !== 256 || height !== 256) {
    throw new Error("Encoder expects a 256x256 image");
  }

  let inOfs = 0;
  let outOfs = 0;
  const palette: number[] = [0];
  const pal = Buffer.alloc(0x80, 0);
  const img = Buffer.alloc(0x8000, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const lowByte = readPixel(data, inOfs, palette);
      inOfs += 4;
      const highByte = readPixel(data, inOfs, palette);
      inOfs += 4;
      const byte = ((highByte << 4) | lowByte) & 0xff;
      img[outOfs] = byte;
      outOfs++;
    }
  }

  outOfs = 0;
  for (let i = 0; i < 16; i++) {
    const texel = palette[i] || 0x0000;
    console.log(texel.toString(16));
    pal.writeUInt16LE(texel, outOfs);
    outOfs += 2;
  }

  return [pal, img];
};

const compressSegment = (
  segment: Buffer,
  max: number,
  min: number,
): [boolean[], Buffer] => {
  // Create a boolean array and out buffer
  const bucket: boolean[] = [];
  const compressed = Buffer.alloc(segment.length);

  // Number of min and max number of words to match
  const MAX_CAP = max;
  const MIN_CAP = min;

  let inOfs = 0;
  let outOfs = 0;

  do {
    // Check ahead
    let found = false;
    const wordsLeft = (segment.length - inOfs) / 2;
    const maxCount = wordsLeft < MAX_CAP ? wordsLeft : MAX_CAP;

    // Check ahead

    for (let count = maxCount; count >= MIN_CAP; count--) {
      const len = count * 2;
      const needle = segment.subarray(inOfs, inOfs + len);
      const window = segment.subarray(0, inOfs);
      const needleOfs = window.indexOf(needle);

      if (needleOfs === -1) {
        continue;
      }

      found = true;
      const lowBits = count - 2;
      const highBits = needleOfs << 3;
      const word = highBits | lowBits;
      compressed.writeUInt16LE(word, outOfs);
      bucket.push(true);
      outOfs += 2;
      inOfs += len;
      break;
    }

    if (!found) {
      const word = segment.readUInt16LE(inOfs);
      inOfs += 2;
      bucket.push(false);
      compressed.writeUInt16LE(word, outOfs);
      outOfs += 2;
    }
  } while (inOfs < segment.length);

  // Write a true bit and 0xffff to finish the segment
  bucket.push(true);
  compressed.writeUInt16LE(0xffff, outOfs);
  outOfs += 2;

  const payload = compressed.subarray(0, outOfs);
  return [bucket, payload];
};

const encodeBitfield = (bits: boolean[]): Buffer => {
  const length = Math.ceil(bits.length / 32) * 4;
  let ofs = 0;
  const buffer = Buffer.alloc(length);
  const dword = new Uint32Array(1);

  for (let i = 0; i < bits.length; i += 32) {
    dword[0] = 0;
    bits[i + 0] && (dword[0] |= 0x80000000);
    bits[i + 1] && (dword[0] |= 0x40000000);
    bits[i + 2] && (dword[0] |= 0x20000000);
    bits[i + 3] && (dword[0] |= 0x10000000);

    bits[i + 4] && (dword[0] |= 0x8000000);
    bits[i + 5] && (dword[0] |= 0x4000000);
    bits[i + 6] && (dword[0] |= 0x2000000);
    bits[i + 7] && (dword[0] |= 0x1000000);

    bits[i + 8] && (dword[0] |= 0x800000);
    bits[i + 9] && (dword[0] |= 0x400000);
    bits[i + 10] && (dword[0] |= 0x200000);
    bits[i + 11] && (dword[0] |= 0x100000);

    bits[i + 12] && (dword[0] |= 0x80000);
    bits[i + 13] && (dword[0] |= 0x40000);
    bits[i + 14] && (dword[0] |= 0x20000);
    bits[i + 15] && (dword[0] |= 0x10000);

    bits[i + 16] && (dword[0] |= 0x8000);
    bits[i + 17] && (dword[0] |= 0x4000);
    bits[i + 18] && (dword[0] |= 0x2000);
    bits[i + 19] && (dword[0] |= 0x1000);

    bits[i + 20] && (dword[0] |= 0x800);
    bits[i + 21] && (dword[0] |= 0x400);
    bits[i + 22] && (dword[0] |= 0x200);
    bits[i + 23] && (dword[0] |= 0x100);

    bits[i + 24] && (dword[0] |= 0x80);
    bits[i + 25] && (dword[0] |= 0x40);
    bits[i + 26] && (dword[0] |= 0x20);
    bits[i + 27] && (dword[0] |= 0x10);

    bits[i + 28] && (dword[0] |= 0x8);
    bits[i + 29] && (dword[0] |= 0x4);
    bits[i + 30] && (dword[0] |= 0x2);
    bits[i + 31] && (dword[0] |= 0x1);

    buffer.writeUInt32LE(dword[0], ofs);
    ofs += 4;
  }

  return buffer;
};

const compressTexture = (
  pal: Buffer,
  img: Buffer,
  max: number,
  min: number,
) => {
  const decompressed = Buffer.concat([pal, img]);

  const segments = [
    decompressed.subarray(0x0000, 0x2000),
    decompressed.subarray(0x2000, 0x4000),
    decompressed.subarray(0x4000, 0x6000),
    decompressed.subarray(0x6000, 0x8000),
    decompressed.subarray(0x8000),
  ];

  const bits: boolean[] = [];
  const loads: Buffer[] = [];
  segments.forEach((segment, index) => {
    const [b, p] = compressSegment(segment, max, min);
    b.forEach((bit) => bits.push(bit));
    loads.push(p);
  });

  const bitfied = encodeBitfield(bits);
  return [bitfied, Buffer.concat(loads)];
};

const replaceTexture = (
  gamefile: Buffer,
  bodyBuffer: Buffer,
  faceBuffer: Buffer,
) => {
  const modded = Buffer.from(gamefile);

  // Replace Body
  const [bodyPal, bodyImg] = encodeImage(bodyBuffer);
  const [bodyBitField, compressedBody] = compressTexture(
    bodyPal,
    bodyImg,
    9,
    4,
  );

  // First we zero out the previous image
  for (let i = 0x30; i < 0x3000; i++) {
    modded[i] = 0;
  }

  // Update the bitfield length in header
  modded.writeInt16LE(bodyBitField.length, 0x24);

  let bodyOfs = 0x30;

  // Write the bitfield
  for (let i = 0; i < bodyBitField.length; i++) {
    modded[bodyOfs++] = bodyBitField[i];
  }

  // Write the compressed Texture
  for (let i = 0; i < compressedBody.length; i++) {
    modded[bodyOfs++] = compressedBody[i];
  }

  console.log("Body End Pos: 0x%s", bodyOfs.toString(16));

  // Replace Body Alternate Palette
  const BODY_ALT_PAL_OFS = 0x3030;
  for (let i = 0; i < bodyPal.length; i++) {
    modded[BODY_ALT_PAL_OFS + i] = bodyPal[i];
  }

  // Replace the face texture
  const [facePal, faceImg] = encodeImage(faceBuffer);
  const megamanFace = readFileSync("fixtures/face-texture.bin");

  // Replace the second hald of the image with special weapons
  for (let i = 0; i < 0x4000; i++) {
    faceImg[0x4000 + i] = megamanFace[0x4080 + i];
  }

  // // First we zero out the previous image
  // for (let i = 0x3830; i < 0x6500; i++) {
  //   modded[i] = 0;
  // }

  // // Compress the face texture
  // const [faceBitField, compressedFace] = compressTexture(
  //   facePal,
  //   faceImg,
  //   9,
  //   3,
  // );

  // // Update the bitfield length in header
  // modded.writeInt16LE(faceBitField.length, 0x3824);

  // let faceOfs = 0x3830;

  // // Write the bitfield
  // for (let i = 0; i < faceBitField.length; i++) {
  //   modded[faceOfs++] = faceBitField[i];
  // }

  // // Write the compressed Texture
  // for (let i = 0; i < compressedFace.length; i++) {
  //   modded[faceOfs++] = compressedFace[i];
  // }

  // console.log("Face End Pos: 0x%s", faceOfs.toString(16));

  return modded;
};

const encodeTexture = (bodyTexture: string, faceTexture: string) => {
  // Encode the body and face texture to write to ROM
  const srcTexture = readFileSync("bin/PL00T.BIN");

  // Read the body Image
  const bodyBuffer = readFileSync(bodyTexture);

  // Read the face Image
  const faceBuffer = readFileSync(bodyTexture);

  // Modify the Game Texture
  const modTexture = replaceTexture(srcTexture, bodyBuffer, faceBuffer);

  // Write the updated game file
  writeFileSync("out/PL00T.BIN", modTexture);
};

export { encodeTexture, encodeImage };
