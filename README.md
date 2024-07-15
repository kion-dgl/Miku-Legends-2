## How to Clone

Note that this repository is written in Bun. Which is basically just using TypeScript and instead of messing around with `ts-node`, it "just works". 
See install instructions over at [https://bun.sh/](https://bun.sh/). 

```bash
$ git clone https://github.com/kion-dgl/Miku-Legends-2.git
$ cd Miku-Legends-2
$ bun i
$ bun test
```

### How to Patch

Once you've confirmed you can clone and the tests work, the next step is to define the input and output for your ROM file.
You will need to specificy this in a `.env` file.

Note that the `SRC_ROM` is Track 1 of the `.BIN` for the `CUE/BIN` file for the CD image. This should be an unedited version
of the game in order for the patcher to correctly search and replace files in the ROM. It will produce a new ROM file with
the updated files with the replaced player character.

```bash
$ vim .env
--- Start File ---
SRC_ROM=/home/kion/Documents/MML2.BIN
DST_ROM=/home/kion/Documents/MIKU2.BIN
--- End File ---
```

Once that is in place, you can run the patcher with 

```bash
$ bun index.ts
```

### Repository Structure


| Directory | Description | 
| ---- | ------ | 
| bin | Archives for MegaMan's Model Files |
| fixtures | Files committed to source for checking tests |
| mod | Exported modded files |
| obj | `.obj` and `.png` files for modding into the game|
| src | Modules and code for encdoing and decoding files from/to the game |
| test | tests for encoding and decoding information into the game |


## MegaMan Model

There is a separate model of MegaMan depending on the equipment. 
The options for this are if a helmet is equipped or not, and if the shoes are jet, cleat, asbestos, or hover.
What this means is that most of the information in the model is duplicated, with the exception of the helmet and shoes.

| File | Helmet | Shoes |
| ---- | ------ | ---- |
| PL00P000.BIN | YES | Normal | 
| PL00P001.BIN | YES | Jet Shoes | 
| PL00P002.BIN | YES | Cleat Shoes | 
| PL00P003.BIN | YES | Asbestos Shoes | 
| PL00P004.BIN | YES | Hydo Shoes | 
| PL00P005.BIN | YES | Hover Shoes | 
| PL00P010.BIN | NO | Normal | 
| PL00P011.BIN | NO | Jet Shoes | 
| PL00P012.BIN | NO | Cleat Shoes | `
| PL00P013.BIN | NO | Asbestos Shoes | 
| PL00P014.BIN | NO | Hydo Shoes | 
| PL00P015.BIN | NO | Hover Shoes | 

## Body Parts

Even through there are variations with all of the models, the offsets for the body parts are the same.
The mesh information stored in each `.BIN` files starts at `0x30` and is `0x2b40` in size.
These offsets are with respect to the start of the model file which is `0x30`.

For the purpose of this document, we will use the term "model" to refer to the enter file,
"mesh" refers to a single body part. And "strip" will refer to the list of commands that make up the mesh.

| Body Part| Offset| Number of Strips |
| --------| ----- | ---------------- |
| Bones| 0x00| 16 | 
| Body| 0x80 | 6 |
| Head| 0xb60 | 3 |
| Feet| 0x1800 | 2 |
| Right Arm| 0x1dd0 | 3 |
| Buster| 0x2220 | 3 |
| Left Arm| 0x26f0 | 3 |

### Strip Format

Each strip is a list of vertices and indices used to draw the mesh. 
Indices are described in either triangles or quads, and both reference the same vertex list.
For the same number of vertices, there are shading vertex colors that describe the local shadows for each face.

```c
typedef struct {
    utin8_t triCount;
    utin8_t quadCount;
    utin8_t vertexCount;
    uint8_t nop;
    uint32_t triOffset;
    uint32_t quadOffset;
    uint32_t vertexOffset;
    utin32_t triShadowOffset;
    utin32_t quadShadowOffset;
} StripHeader;
```

| 0x00 | 0x01 | 0x02 | 0x03 | 0x04 | 0x08 | 0x0c | 0x10 | 0x14 | 
| --------| ----- | ---------------- | ----- | ---- | ----- | ---- | ----- | --- |
| Tri Count | Quad Count  | Vertex Count | NOP | Tri Ofs | Quad Ofs | Vertex Ofs | Tri Shadow Ofs | Quad Shadow Ofs |

### Vertex Format

Issue: https://github.com/kion-dgl/Miku-Legends-2/issues/6

### Face Format

Issue: https://github.com/kion-dgl/Miku-Legends-2/issues/12

## Credits

- Miku Model by [Xinus22](https://x.com/xinus22)
- Helmet, Buster and Special Weapons by [suitNtie22](https://x.com/suitNtie22)
