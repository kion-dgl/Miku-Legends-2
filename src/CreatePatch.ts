import { readFileSync, writeFileSync } from "fs";

type GamePatch = {
  offset: number;
  bytes: string;
};

const createPatch = () => {
  const sourceRom = process.env.SRC_ROM;
  if (!sourceRom) {
    throw new Error("Need to set SRC_ROM value in .env");
  }

  const romDst = process.env.DST_ROM;
  if (!romDst) {
    throw new Error("Need to set DST_ROM value in .env");
  }

  const rom = readFileSync(sourceRom);
  const mod = readFileSync(romDst);

  // The sequence should be an array where the offsets that are
  // different between the source and the mod are added to the sequence

  const patch = [];

  let isDiff = false;
  let start = 0;
  let len = 0;

  console.log("Create Patch");
  for (let i = 0; i < rom.length; i++) {
    if (!isDiff && mod[i] !== rom[i]) {
      // First we want to start logging when the bytes are different
      start = i;
      len = 1;
      isDiff = true;
    } else if (isDiff && mod[i] !== rom[i]) {
      // And if the bytes are different, we want to record how many
      len++;
    } else if (isDiff && mod[i] === rom[i]) {
      // Only once the bytes stop being different do we log them into the patch
      patch.push({
        offset: start,
        bytes: mod.subarray(start, start + len).toString("base64"),
      });
      isDiff = false;
      len = 0;
    }
  }

  writeFileSync("./docs/patch.json", JSON.stringify(patch, null, 2));
};

export default createPatch;
export { createPatch };
