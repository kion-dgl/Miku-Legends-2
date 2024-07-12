import { readFileSync, writeFileSync, readdirSync } from "fs";

const replaceInRom = (sourceRom: Buffer, sourceFile: Buffer, moddedFile: Buffer) {

}

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

  const replaceFiles = readdirSync("./mod");
  replaceFiles.forEach((filename) => {
    const sourceFile = readFileSync(`./bin/${filename}`);
    const moddedFile = readFileSync(`./mod/${filename}`);
    replaceInRom(rom, sourceFile, moddedFile)
  });

  writeFileSync(romDst, rom)
};

export { encodeRom };
export default encodeRom;
