/*
    This file is part of ByteReader Library
    Copyright 2023 [Benjamin Collins](kion@dashgl.com)

    Permission is hereby granted, free of charge, to any person obtaining 
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including 
    without limitation the rights to use, copy, modify, merge, publish, 
    distribute, sublicense, and/or sell copies of the Software, and to 
    permit persons to whom the Software is furnished to do so, subject to 
    the following conditions:

    The above copyright notice and this permission notice shall be included     
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    
*/

export default class ByteReader {
    private ofs: number;
    private view: DataView;
    private littleEndian: boolean;
    private length: number;
    private bytes: ArrayBuffer;

    constructor(bytes: ArrayBuffer, littleEndian = true) {
        this.bytes = bytes;
        this.length = bytes.byteLength;
        this.view = new DataView(bytes);
        this.ofs = 0;
        this.littleEndian = littleEndian;
    }

    seek(whence: number): void {
        this.ofs = whence;
    }

    seekRel(whence: number): void {
        this.ofs += whence;
    }

    seekEnd(whence: number): void {
        if (whence > 0) {
            console.warn('ByteStream seekEnd function expects a negative whence argument');
        }
        this.ofs = this.length + whence;
    }

    tell(): number {
        return this.ofs;
    }

    tellf(): string {
        return `0x${this.ofs.toString(16).padStart(6, '0')}`;
    }

    readInt8(): number {
        const n = this.view.getInt8(this.ofs);
        this.ofs += 1;
        return n;
    }

    readUInt8(): number {
        const n = this.view.getUint8(this.ofs);
        this.ofs += 1;
        return n;
    }

    readInt16(): number {
        const n = this.view.getInt16(this.ofs, this.littleEndian);
        this.ofs += 2;
        return n;
    }

    readUInt16(): number {
        const n = this.view.getUint16(this.ofs, this.littleEndian);
        this.ofs += 2;
        return n;
    }

    readInt32(): number {
        const n = this.view.getInt32(this.ofs, this.littleEndian);
        this.ofs += 4;
        return n;
    }

    readUInt32(): number {
        const n = this.view.getUint32(this.ofs, this.littleEndian);
        this.ofs += 4;
        return n;
    }

    readFloat(): number {
        const n = this.view.getFloat32(this.ofs, this.littleEndian);
        this.ofs += 4;
        return n;
    }

    readString(length = 0): string {
        let str = '';
        const end = length > 0 ? this.ofs + length : this.length;
        do {
            const n = this.readUInt8();
            if (n === 0) {
                break;
            }
            str += String.fromCharCode(n);
        } while (this.ofs < end);
        return str;
    }

    toString(startOffset: number, endOffset: number): string {
        let str = '';
        for (let ofs = startOffset; startOffset < endOffset; ofs++) {
            const n = this.view.getInt8(ofs);
            str += String.fromCharCode(n);
        }
        return str;
    }

    subArray(startOffset: number, endOffset: number): ArrayBuffer {
        return this.bytes.slice(startOffset, endOffset);
    }
}
