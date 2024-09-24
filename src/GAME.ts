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
import { encodeTexel } from "./EncodeTexture";

const updateDemoLogo = () => {
  const bin = readFileSync("bin/GAME.BIN");
  const red = encodeTexel(255, 0, 0, 255);

  const palOfs = 0x44800;
  for (let i = 0; i < 16; i++) {
    bin.writeUInt16LE(red, palOfs + 0x30 + i * 2);
  }

  writeFileSync("out/GAME.BIN", bin);
};

export default updateDemoLogo;
export { updateDemoLogo };
