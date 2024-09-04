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

import { readFileSync, writeFileSync } from "fs";
const CHUNK_SIZE = 0x800;
const STRIDE_SIZE = 0x930;

interface FileEntry {
  name: string;
  offset: number;
  size: number;
}

const replaceSegment = (rom: Buffer, needles: Buffer[], contents: Buffer[]) => {
  let whence = -1;
  needles.forEach((needle, index) => {
    const locations: number[] = [];

    if (index === 0) {
      do {
        whence += 1;
        whence = rom.indexOf(needle, whence);
        if (whence !== -1) {
          locations.push(whence);
        }
      } while (whence !== -1);

      if (locations.length !== 1) {
        throw new Error("Only one match expected for segment");
      }

      whence = locations[0];
    } else {
      whence = rom.indexOf(needle, whence);
    }

    if (whence === -1) {
      throw new Error("Unable to Find Needle");
    }

    console.log("Replacing: ", index);
    const content = contents[index];
    for (let i = 0; i < content.length; i++) {
      rom[whence++] = content[i];
    }
  });
};

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
  rom.writeUInt32LE(0x90 + PLAYER_OFFSET, ofs + 0); // Body
  rom.writeUInt32LE(0x130 + PLAYER_OFFSET, ofs + 4); // Head
  rom.writeUInt32LE(0x190 + PLAYER_OFFSET, ofs + 24); // Feet
  rom.writeUInt32LE(0x1d0 + PLAYER_OFFSET, ofs + 16); // Left Arm
  rom.writeUInt32LE(0x230 + PLAYER_OFFSET, ofs + 8); // Right Arm
  rom.writeUInt32LE(0x290 + PLAYER_OFFSET, ofs + 20); // Buster
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

  const mikuTitle = readFileSync("out/TITLE.BIN");
  const title = readFileSync("bin/TITLE.BIN");

  console.log("--- Replacing Title ---");
  replaceInRom(rom, title, mikuTitle);

  // Replace Textures
  const mikuTexture = readFileSync("out/PL00T.BIN");
  const pl00t = readFileSync("bin/PL00T.BIN");
  const mikuTexturePatch = readFileSync("out/PL00T2.BIN");
  const pl00t2 = readFileSync("bin/PL00T2.BIN");
  // const st03a2 = readFileSync("./bin/ST3A02.BIN");
  // const st03a2Miku = readFileSync("./out/ST3A02.BIN");

  console.log("--- Replacing Textures ---");
  console.log("  - Body + Face Texture (compressed)");
  replaceInRom(rom, pl00t, mikuTexture);
  console.log("  - Body + Face Texture (uncompressed)");
  replaceInRom(rom, pl00t2, mikuTexturePatch);
  // console.log("  - First Cut Scene Patch");
  // replaceInRom(rom, st03a2, st03a2Miku);

  // Encode Models
  const mikuHairNorm = readFileSync("out/PL00P010.BIN");
  const mikuHairJet = readFileSync("out/PL00P011.BIN");
  const mikuHairHydro = readFileSync("out/PL00P012.BIN");
  const mikuHairAsbestos = readFileSync("out/PL00P013.BIN");
  const mikuHairCleated = readFileSync("out/PL00P014.BIN");
  const mikuHairHover = readFileSync("out/PL00P015.BIN");

  const mikuHelmetNorm = readFileSync("out/PL00P000.BIN");
  const mikuHelmetJet = readFileSync("out/PL00P001.BIN");
  const mikuHelmetHydro = readFileSync("out/PL00P002.BIN");
  const mikuHelmetAsbestos = readFileSync("out/PL00P003.BIN");
  const mikuHelmetCleated = readFileSync("out/PL00P004.BIN");
  const mikuHelmetHover = readFileSync("out/PL00P005.BIN");

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

  console.log("--- Replacing Models ---");

  console.log("  - Helmet + Normal Shoes");
  replaceInRom(rom, megaman[0], mikuHelmetNorm);
  console.log("  - Helmet + Jet Skates");
  replaceInRom(rom, megaman[1], mikuHelmetJet);
  console.log("  - Helmet + Hydro");
  replaceInRom(rom, megaman[2], mikuHelmetHydro);
  console.log("  - Helmet + Asbestos");
  replaceInRom(rom, megaman[3], mikuHelmetAsbestos);
  console.log("  - Helmet + Cleated");
  replaceInRom(rom, megaman[4], mikuHelmetCleated);
  console.log("  - Helmet + Hover");
  replaceInRom(rom, megaman[5], mikuHelmetHover);

  console.log("  - No Helmet + Normal Shoes");
  replaceInRom(rom, megaman[6], mikuHairNorm);
  console.log("  - No Helmet + Jet Skates");
  replaceInRom(rom, megaman[7], mikuHairJet);
  console.log("  - No Helmet + Hydro");
  replaceInRom(rom, megaman[8], mikuHairHydro);
  console.log("  - No Helmet + Asbestos");
  replaceInRom(rom, megaman[9], mikuHairAsbestos);
  console.log("  - No Helmet + Cleated");
  replaceInRom(rom, megaman[10], mikuHairCleated);
  console.log("  - No Helmet + Hover");
  replaceInRom(rom, megaman[11], mikuHairHover);

  // Update Pointer Table
  console.log("- Updating Pointer table -");
  updatePointerTable(rom);

  // Update Specual weapons
  console.log("--- Replacing Weapons ---");

  const wpn_02 = readFileSync("bin/wpn_PL00R02.BIN");
  const miku_02 = readFileSync("out/PL00R02.BIN");

  console.log("  - 0x02 Crusher");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_02.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(wpn_02.subarray(0x4000, 0x4000 + 0x800)),
    ],
    [
      Buffer.from(miku_02.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(miku_02.subarray(0x4000, 0x4000 + 0x800)),
    ],
  );

  const wpn_03 = readFileSync("bin/wpn_PL00R03.BIN");
  const miku_03 = readFileSync("out/PL00R03.BIN");

  console.log("  - 0x03 Buster Cannon");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_03.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(wpn_03.subarray(0x4000, 0x4000 + 0x800)),
    ],
    [
      Buffer.from(miku_03.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(miku_03.subarray(0x4000, 0x4000 + 0x800)),
    ],
  );

  const wpn_04 = readFileSync("bin/wpn_PL00R04.BIN");
  const miku_04 = readFileSync("out/PL00R04.BIN");

  console.log("  - 0x04 Hyper Shell");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_04.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(wpn_04.subarray(0x3800, 0x3800 + 0x800)),
    ],
    [
      Buffer.from(miku_04.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(miku_04.subarray(0x3800, 0x3800 + 0x800)),
    ],
  );

  const wpn_05 = readFileSync("bin/wpn_PL00R05.BIN");
  const miku_05 = readFileSync("out/PL00R05.BIN");

  console.log("  - 0x05 Homing Missle");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_05.subarray(0x800, 0x800 + 0x800)),
      Buffer.from(wpn_05.subarray(0x2800, 0x2800 + 0x800)),
    ],
    [
      Buffer.from(miku_05.subarray(0x800, 0x800 + 0x800)),
      Buffer.from(miku_05.subarray(0x2800, 0x2800 + 0x800)),
    ],
  );

  const wpn_06 = readFileSync("bin/wpn_PL00R06.BIN");
  const miku_06 = readFileSync("out/PL00R06.BIN");

  console.log("  - 0x06 Ground Crawler");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_06.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(wpn_06.subarray(0x3000, 0x3000 + 0x800)),
    ],
    [
      Buffer.from(miku_06.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(miku_06.subarray(0x3000, 0x3000 + 0x800)),
    ],
  );

  const wpn_07 = readFileSync("bin/wpn_PL00R07.BIN");
  const miku_07 = readFileSync("out/PL00R07.BIN");

  console.log("  - 0x07 Vacuum Arm");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_07.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(wpn_07.subarray(0x2800, 0x2800 + 0x800)),
    ],
    [
      Buffer.from(miku_07.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(miku_07.subarray(0x2800, 0x2800 + 0x800)),
    ],
  );

  const wpn_08 = readFileSync("bin/wpn_PL00R08.BIN");
  const miku_08 = readFileSync("out/PL00R08.BIN");

  console.log("  - 0x08 Reflector Arm");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_08.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(wpn_08.subarray(0x2800, 0x2800 + 0x800)),
    ],
    [
      Buffer.from(miku_08.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(miku_08.subarray(0x2800, 0x2800 + 0x800)),
    ],
  );

  const wpn_09 = readFileSync("bin/wpn_PL00R09.BIN");
  const miku_09 = readFileSync("out/PL00R09.BIN");

  console.log("  - 0x09 Shield Arm");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_09.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(wpn_09.subarray(0x2800, 0x2800 + 0x800)),
    ],
    [
      Buffer.from(miku_09.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(miku_09.subarray(0x2800, 0x2800 + 0x800)),
    ],
  );

  const wpn_0A = readFileSync("bin/wpn_PL00R0A.BIN");
  const miku_0A = readFileSync("out/PL00R0A.BIN");

  console.log("  - 0x0A Blade Arm");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_0A.subarray(0x1800, 0x1800 + 0x800)),
      Buffer.from(wpn_0A.subarray(0x3800, 0x3800 + 0x800)),
    ],
    [
      Buffer.from(miku_0A.subarray(0x1800, 0x1800 + 0x800)),
      Buffer.from(miku_0A.subarray(0x3800, 0x3800 + 0x800)),
    ],
  );

  const wpn_0B = readFileSync("bin/wpn_PL00R0B.BIN");
  const miku_0B = readFileSync("out/PL00R0B.BIN");

  console.log("  - 0x0B Shining Laser");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_0B.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(wpn_0B.subarray(0x3800, 0x3800 + 0x800)),
    ],
    [
      Buffer.from(miku_0B.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(miku_0B.subarray(0x3800, 0x3800 + 0x800)),
    ],
  );

  const wpn_0C = readFileSync("bin/wpn_PL00R0C.BIN");
  const miku_0C = readFileSync("out/PL00R0C.BIN");

  console.log("  - 0x0C Machine Gun Arm");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_0C.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(wpn_0C.subarray(0x3800, 0x3800 + 0x800)),
    ],
    [
      Buffer.from(miku_0C.subarray(0x2000, 0x2000 + 0x800)),
      Buffer.from(miku_0C.subarray(0x3800, 0x3800 + 0x800)),
    ],
  );

  const wpn_0D = readFileSync("bin/wpn_PL00R0D.BIN");
  const miku_0D = readFileSync("out/PL00R0D.BIN");

  console.log("  - 0x0D Spread Buster");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_0D.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(wpn_0D.subarray(0x3000, 0x3000 + 0x800)),
    ],
    [
      Buffer.from(miku_0D.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(miku_0D.subarray(0x3000, 0x3000 + 0x800)),
    ],
  );

  const wpn_0E = readFileSync("bin/wpn_PL00R0E.BIN");
  const miku_0E = readFileSync("out/PL00R0E.BIN");

  console.log("  - 0x0E Aqua Blaster");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_0E.subarray(0x1800, 0x1800 + 0x800)),
      Buffer.from(wpn_0E.subarray(0x3800, 0x3800 + 0x800)),
    ],
    [
      Buffer.from(miku_0E.subarray(0x1800, 0x1800 + 0x800)),
      Buffer.from(miku_0E.subarray(0x3800, 0x3800 + 0x800)),
    ],
  );

  const wpn_0F = readFileSync("bin/wpn_PL00R0F.BIN");
  const miku_0F = readFileSync("out/PL00R0F.BIN");

  console.log("  - 0x0F Hunter Seeker");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_0F.subarray(0x1800, 0x1800 + 0x800)),
      Buffer.from(wpn_0F.subarray(0x3800, 0x3800 + 0x800)),
    ],
    [
      Buffer.from(miku_0F.subarray(0x1800, 0x1800 + 0x800)),
      Buffer.from(miku_0F.subarray(0x3800, 0x3800 + 0x800)),
    ],
  );

  const wpn_10 = readFileSync("bin/wpn_PL00R10.BIN");
  const miku_10 = readFileSync("out/PL00R10.BIN");

  console.log("  - 0x10 Drill Arm");
  replaceSegment(
    rom,
    [
      Buffer.from(wpn_10.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(wpn_10.subarray(0x2800, 0x2800 + 0x800)),
    ],
    [
      Buffer.from(miku_10.subarray(0x1000, 0x1000 + 0x800)),
      Buffer.from(miku_10.subarray(0x2800, 0x2800 + 0x800)),
    ],
  );

  // Update Cut Scene Textures

  const CUT_SCENES = [
    "cut-ST1CT.BIN",
    "cut-ST1C01.BIN",
    "cut-ST1FT.BIN",
    "cut-ST03T.BIN",
    "cut-ST3A02.BIN",
    "cut-ST4B01.BIN",
    "cut-ST4BT.BIN",
    "cut-ST4CT.BIN",
    "cut-ST5C01.BIN",
    "cut-ST15T.BIN",
    "cut-ST17T.BIN",
    "cut-ST1700.BIN",
    "cut-ST1701.BIN",
    "cut-ST1702.BIN",
    "cut-ST25T.BIN",
    "cut-ST27T.BIN",
    "cut-ST28T.BIN",
    "cut-ST30T.BIN",
    "cut-ST3001T.BIN",
    "cut-ST31T.BIN",
    "cut-ST39T.BIN",
    "cut-ST46T.BIN",
    "cut-ST52T.BIN",
    "cut-ST0305.BIN",
    "cut-ST1802T.BIN",
    "cut-ST1803.BIN",
    "cut-ST2501.BIN",
  ];

  console.log("--- Replacing Cut Scene Textures ---");

  CUT_SCENES.forEach((name) => {
    console.log(`  - ${name}`);
    const src =
      name === "cut-ST3A02.BIN"
        ? readFileSync(`bin/ST3A02.BIN`)
        : readFileSync(`bin/${name}`);
    const mod = readFileSync(`out/${name}`);
    replaceInRom(rom, src, mod);
  });

  // Write the result
  console.log("--- Wiritng ROM ---");
  console.log("rom file: %s", romDst);
  writeFileSync(romDst, rom);
};

export { encodeRom, findFileOffset, findPointerTable };
export default encodeRom;
