import { readFileSync, writeFileSync } from "fs";
const CHUNK_SIZE = 0x800;
const STRIDE_SIZE = 0x930;

interface FileEntry {
  name: string;
  offset: number;
  size: number;
}

// Function to find file offset within the BIN file
const findFileOffset = (rom: Buffer, file: Buffer) => {
  const needle = file.subarray(0, 0x800);
  let whence = -1;
  const locations: number[] = [];
  do {
    whence += 1;
    whence = rom.indexOf(needle, whence);
    locations.push(whence);
  } while (whence !== -1);
  locations.pop();

  const segmentCount = Math.ceil(file.length / 0x800);
  const segments: Buffer[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(file.subarray(i * 0x800, (i + 1) * 0x800));
  }

  for (let i = 0; i < locations.length; i++) {
    const whence = locations[i];
    const array = segments.map((segment, index) =>
      rom.indexOf(segment, whence + index * 0x930),
    );
    if (array.indexOf(-1) !== -1) {
      continue;
    }
    const found = array.reduce((acc, current, index, arr) => {
      // If the accumulator is already false, no need to continue
      if (!acc) return false;
      // Check if we are not at the first element
      if (index > 0) {
        // Calculate the difference between current and previous element
        const difference = current - arr[index - 1];
        // If the difference is not 0x930, return false
        if (difference !== 0x930) return false;
      }
      // Otherwise, return true
      return true;
    }, true);

    if (found) {
      return whence;
    }
  }

  return -1;
};

const findPointerTable = (rom: Buffer) => {
  const PLAYER_OFFSET = 0x110800;
  const body = 0x80;
  const head = 0xb60;
  const rightArm = 0x26f0;
  const eof = 0x2b40;
  const leftArm = 0x1dd0;
  const buster = 0x2220;
  const feet = 0x1800;

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

    return i;
  }

  return -1;
};

const updatePointerTable = (rom: Buffer) => {
  const ofs = findPointerTable(rom);
  const PLAYER_OFFSET = 0x110800;
  rom.writeUInt32LE(0x110 + PLAYER_OFFSET, ofs + 4); // Head
  rom.writeUInt32LE(0x158 + PLAYER_OFFSET, ofs + 24); // Feet
  rom.writeUInt32LE(0x188 + PLAYER_OFFSET, ofs + 16); // Left Arm
  rom.writeUInt32LE(0x1d0 + PLAYER_OFFSET, ofs + 20); // Buster
  rom.writeUInt32LE(0x218 + PLAYER_OFFSET, ofs + 12); // Right Arm
};

const replaceInRom = (
  sourceRom: Buffer,
  sourceFile: Buffer,
  moddedFile: Buffer,
) => {
  let ofs = findFileOffset(sourceRom, sourceFile);
  if (ofs === -1) {
    throw new Error("Cannot mod file (not found!!!!!)");
  }
  const segmentCount = Math.ceil(moddedFile.length / 0x800);
  const segments: Buffer[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push(moddedFile.subarray(i * 0x800, (i + 1) * 0x800));
  }

  segments.forEach((segment) => {
    for (let i = 0; i < segment.length; i++) {
      sourceRom[ofs + i] = segment[i];
    }
    ofs += 0x930;
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
  // replaceInRom(rom, pl00t, mikuTexture);
  // replaceInRom(rom, pl00t2, mikuTexture);

  // Encode Models
  const mikuHairNorm = readFileSync("out/PL00P010.BIN");
  const megaman = [
    readFileSync("bin/PL00P000.BIN"),
    readFileSync("bin/PL00P001.BIN"),
    readFileSync("bin/PL00P002.BIN"),
    readFileSync("bin/PL00P003.BIN"),
    readFileSync("bin/PL00P004.BIN"),
    readFileSync("bin/PL00P005.BIN"),
    readFileSync("bin/PL00P010.BIN"),
    readFileSync("bin/PL00P011.BIN"),
    readFileSync("bin/PL00P012.BIN"),
    readFileSync("bin/PL00P013.BIN"),
    readFileSync("bin/PL00P014.BIN"),
    readFileSync("bin/PL00P015.BIN"),
  ];

  // Replace Models
  megaman.forEach((file) => {
    replaceInRom(rom, file, mikuHairNorm);
  });

  // Update Pointer Table
  updatePointerTable(rom);

  // Write the result
  writeFileSync(romDst, rom);
};

export { encodeRom, findFileOffset, findPointerTable };
export default encodeRom;
