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

## Credits

- Miku Model by [Xinus22](https://x.com/xinus22)
- Helmet, Buster and Special Weapons by [suitNtie22](https://x.com/suitNtie22)
