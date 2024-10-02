![Miku_Legends2_Logo](https://github.com/user-attachments/assets/8c32c8fc-444b-4f93-b298-6d3a05ea6d1c)

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


## Format Documentation

Documentation for File Formats used in MegaMan Legends 2 can be found here: [https://format.dashgl.com/mml2/](https://format.dashgl.com/mml2/)

## Credits

- Miku Model by [Xinus22](https://x.com/xinus22)
- Helmet, Buster and Special Weapons by [suitNtie22](https://x.com/suitNtie22)
- Logo by [Sumigummy](https://x.com/SumiGummy)
