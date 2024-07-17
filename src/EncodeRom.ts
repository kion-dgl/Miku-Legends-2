import { readFileSync, writeFileSync } from "fs";
import { RGBA_ASTC_10x5_Format } from "three";
const CHUNK_SIZE = 0x800;
const STRIDE_SIZE = 0x930;

const replaceInRom = (
  sourceRom: Buffer,
  sourceFile: Buffer,
  moddedFile: Buffer,
) => {
  const totalChunks = Math.ceil(sourceFile.length / CHUNK_SIZE);
  const chunkPos: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = start + CHUNK_SIZE;
    const needle = sourceFile.subarray(start, end);
    chunkPos.push(sourceRom.indexOf(needle));
  }

  console.log(chunkPos);

  // Find the largest continuous section with a difference of STRIDE_SIZE
  let longestSeqStart = 0;
  let longestSeqLength = 0;
  let currentSeqStart = 0;
  let currentSeqLength = 1;

  for (let i = 0; i < chunkPos.length - 1; i++) {
    const diff = chunkPos[i + 1] - chunkPos[i];
    if (diff === STRIDE_SIZE) {
      currentSeqLength++;
    } else {
      if (currentSeqLength > longestSeqLength) {
        longestSeqStart = currentSeqStart;
        longestSeqLength = currentSeqLength;
      }
      currentSeqStart = i + 1;
      currentSeqLength = 1;
    }
  }

  // Check the last sequence
  if (currentSeqLength > longestSeqLength) {
    longestSeqStart = currentSeqStart;
    longestSeqLength = currentSeqLength;
  }

  // Normalize positions
  for (let i = longestSeqStart - 1; i >= 0; i--) {
    chunkPos[i] = chunkPos[i + 1] - STRIDE_SIZE;
  }
  for (let i = longestSeqStart + 1; i < chunkPos.length; i++) {
    chunkPos[i] = chunkPos[i - 1] + STRIDE_SIZE;
  }
  console.log("Found at: 0x%s", chunkPos[0].toString(16));

  let ofs = 0;
  chunkPos.forEach((pos) => {
    for (let i = 0; i < CHUNK_SIZE; i++) {
      sourceRom[pos + i] = moddedFile[ofs++];
    }
  });
};

const encodeRom = () => {
  console.log("Encoding the rom");
  const sourceRom = process.env.SRC_ROM;
  if (!sourceRom) {
    throw new Error("Need to set SRC_ROM value in .env");
  }

  const romDst = process.env.DST_ROM;
  if (!romDst) {
    throw new Error("Need to set DST_ROM value in .env");
  }

  const rom = readFileSync(sourceRom);

  // Replace Textures
  const mikuTexture = readFileSync("out/PL00T.BIN");
  const pl00t = readFileSync("bin/PL00T.BIN");
  const pl00t2 = readFileSync("bin/PL00T2.BIN");
  replaceInRom(rom, pl00t, mikuTexture);
  replaceInRom(rom, pl00t2, mikuTexture);

  // Encode Models
  const mikuHairNorm = readFileSync("out/PL00P010.BIN").subarray(
    0x30,
    0x30 + 0x2b40,
  );

  const megaman = [
    readFileSync("bin/PL00P010.BIN").subarray(0x30, 0x30 + 0x2b40),
  ];

  // Replace Models
  megaman.forEach((file) => {
    replaceInRom(rom, file, mikuHairNorm);
  });

  // Write the result
  writeFileSync(romDst, rom);
};

export { encodeRom };
export default encodeRom;
