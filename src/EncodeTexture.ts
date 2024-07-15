import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";

const encodeTexel = (r: number, g: number, b: number, a: number) => {
  const rClr = Math.floor((r >> 3) & 0xff);
  const gClr = Math.floor((g >> 3) & 0xff);
  const bClr = Math.floor((b >> 3) & 0xff);
  const aClr = a === 0 ? 0 : 0x8000;
  const texel = rClr | (gClr << 5) | (bClr << 5) | aClr;
  return texel;
};

const encodeImage = (pngSrc: Buffer) => {
  const pngInfo = PNG.sync.read(pngSrc);
  const { width, height, data } = pngInfo;

  console.log("Encoding image");

  if (width !== 256 || height !== 256) {
    throw new Error("Encoder expects a 256x256 image");
  }

  console.log(data.length.toString(16));

  let inOfs = 0;
  let outOfs = 0;
  const palette: number[] = [0];
  const pal = Buffer.alloc(0x20, 0);
  const img = Buffer.alloc(0x8000, 0);

  const readPixel = () => {
    const a = data.readUInt8(inOfs + 3) === 0 ? 0 : 255;
    const r = a === 0 ? 0 : data.readUInt8(inOfs + 0);
    const g = a === 0 ? 0 : data.readUInt8(inOfs + 1);
    const b = a === 0 ? 0 : data.readUInt8(inOfs + 2);
    const texel = encodeTexel(r, g, b, a);
    inOfs += 4;

    // Search through the existing palette
    const index = palette.indexOf(texel);

    // If doesn't exist, we add it to the palette
    if (index === -1) {
      const pos = palette.length;
      palette.push(texel);
      return pos;
    }

    return index;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const lowByte = readPixel();
      const highByte = readPixel();
      const byte = ((highByte << 4) | lowByte) & 0xff;
      img[outOfs] = byte;
      outOfs++;
    }
  }

  // for(let i = 0; i < palette.length; i++){
  //     console.log(palette[i].toString(16))
  // }

  outOfs = 0;
  console.log("Palette colors: ");
  for (let i = 0; i < 16; i++) {
    const texel = palette[i] || 0x0000;
    console.log(texel.toString(16));
    pal.writeUInt16LE(texel, outOfs);
    outOfs += 2;
  }

  return [pal, img];
};

const replaceTexture = (
  gamefile: Buffer,
  bodyBuffer: Buffer,
  faceBuffer: Buffer,
) => {
  const modded = Buffer.from(gamefile);
  const [bodyPal, bodyImg] = encodeImage(bodyBuffer);
  const [facePal, faceImg] = encodeImage(faceBuffer);

  let ofs = 0;

  // Paltte 0
  const bodyPalOfs = 0x30;
  ofs = bodyPalOfs;
  for (let i = 0; i < bodyPal.length; i++) {
    modded[bodyPalOfs + i] = bodyPal[i];
  }

  // Image 0
  const bodyImgOfs = 0x800;
  for (let i = 0; i < 0x8000; i++) {
    modded[bodyImgOfs + i] = bodyImg[i];
  }

  // palette 1
  // Black for the second texture
  ofs = 0x8830;
  for (let pal = 0; pal < 3; pal++) {
    for (let i = 0; i < 16; i++) {
      modded.writeUInt16LE(0x8000, ofs);
      ofs += 2;
    }
  }

  // Pallete 2
  const facePalOfs = 0x9030;
  for (let i = 0; i < facePal.length; i++) {
    modded[facePalOfs + i] = facePal[i];
  }

  // Image 1
  const faceImgOfs = 0x9800;
  for (let i = 0; i < 0x4000; i++) {
    modded[faceImgOfs + i] = faceImg[i];
  }

  return modded;
};

const encodeTexture = (bodyTexture: string, faceTexture: string) => {
  // Encode the body and face texture to write to ROM
  const srcTexture = readFileSync("bin/PL00T.BIN");
  const bodyBuffer = readFileSync(bodyTexture);
  const faceBuffer = readFileSync(faceTexture);
  const modTexture = replaceTexture(srcTexture, bodyBuffer, faceBuffer);
  writeFileSync("mod/PL00T.BIN", modTexture);
};

export { encodeTexture };
