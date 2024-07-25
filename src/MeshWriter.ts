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

import { Vector3, Matrix4 } from "three";

const encodeVertex = (xRaw: number, yRaw: number, zRaw: number) => {

    const SCALE = 1 / 0.00125;
    const ROT_X = new Matrix4();
    ROT_X.makeRotationX(Math.PI);

    const vec3 = new Vector3(xRaw, yRaw, zRaw);
    // vec3.multiplyScalar(SCALE);
    // vec3.applyMatrix4(ROT_X);

    // // Round each value to nearest whole int
    vec3.x = Math.round(vec3.x)
    vec3.y = Math.round(vec3.y)
    vec3.z = Math.round(vec3.z)

    // // Encode x,y,z to signed 10 but values
    const { x, y, z } = vec3;
    try {
        const xInt = encodeVertexBits(x)
        const yInt = encodeVertexBits(y)
        const zInt = encodeVertexBits(z)
        // Shift and merge vertex to make a 32 bit value
        const vertex = xInt | (yInt << 10) | (zInt << 20)
        return vertex
    } catch (err) {
        console.log("0 Scale invalid: ", x, y, z)
    }

    try {
        const xInt = encodeVertexBits(Math.floor(x / 2))
        const yInt = encodeVertexBits(Math.floor(y / 2))
        const zInt = encodeVertexBits(Math.floor(z / 2))
        // Shift and merge vertex to make a 32 bit value
        const vertex = xInt | (yInt << 10) | (zInt << 20) | (1 << 30)
        return vertex
    } catch (err) {
        console.log("1 Scale invalid: ", x, y, z)
        throw err;
    }


}

// Encode the Vertices
const encodeVertexBits = (num: number) => {

    if (num < 0) {
        const lowBits = 512 + num;
        const encodedVert = 0x200 | lowBits;
        if (encodedVert > 0x3ff) {
            return 0x3ff;
        }
        return encodedVert
    } else {
        if (num > 0x1ff) {
            return 0x1ff;
        }
        return num;
    }
}

export { encodeVertex, encodeVertexBits }