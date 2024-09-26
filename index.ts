import { encodeModel } from "./src/EncodeModel";
import { encodeTexture, encodeCutScenes } from "./src/EncodeTexture";
import { encodeTitle } from "./src/EncodeTitle";
import { encodeRom } from "./src/EncodeRom";
import { encodeApronMegaman } from "./src/ST0305";
import { updateST03T } from "./src/ST03T";
import { updateSceneModel } from "./src/ST03";
import {
  replaceCrusher,
  replaceBusterCannon,
  replaceHyperShell,
  replaceHomingMissle,
  replaceGroundCrawler,
  replaceVacuumArm,
  replaceReflectorArm,
  replaceBladeArm,
  replaceShieldArm,
  replaceShiningLaser,
  replaceMachineGunArm,
  replaceSpreadBuster,
  replaceAquaBlaster,
  replaceHunterSeeker,
  replaceDrillArm,
} from "./src/EncodeWeapon";
import { updateDemoLogo } from "./src/GAME";
import { updateFlutterPaintings } from "./src/ST05T";
import { updateYosyonkePaintings } from "./src/ST47T";
import { updateYosyonkePaintings2 } from "./src/ST0AT";
import { updateYosyonkePaintings3 } from "./src/ST0CT";

encodeTitle("miku/title.png");
// process.exit();

// Encode the Texture
encodeTexture(
  // Body Texture
  "miku/miku_body.png",
  // Face Texture
  "miku/face-1.png",
  // Special Weapon
  "miku/megaman_img_002.png",
);

encodeCutScenes();

/**
    $$\      $$\ $$\   $$\     $$\             $$\   $$\           $$\                          $$\
    $$ | $\  $$ |\__|  $$ |    $$ |            $$ |  $$ |          $$ |                         $$ |
    $$ |$$$\ $$ |$$\ $$$$$$\   $$$$$$$\        $$ |  $$ | $$$$$$\  $$ |$$$$$$\$$$$\   $$$$$$\ $$$$$$\
    $$ $$ $$\$$ |$$ |\_$$  _|  $$  __$$\       $$$$$$$$ |$$  __$$\ $$ |$$  _$$  _$$\ $$  __$$\\_$$  _|
    $$$$  _$$$$ |$$ |  $$ |    $$ |  $$ |      $$  __$$ |$$$$$$$$ |$$ |$$ / $$ / $$ |$$$$$$$$ | $$ |
    $$$  / \$$$ |$$ |  $$ |$$\ $$ |  $$ |      $$ |  $$ |$$   ____|$$ |$$ | $$ | $$ |$$   ____| $$ |$$\
    $$  /   \$$ |$$ |  \$$$$  |$$ |  $$ |      $$ |  $$ |\$$$$$$$\ $$ |$$ | $$ | $$ |\$$$$$$$\  \$$$$  |
    \__/     \__|\__|   \____/ \__|  \__|      \__|  \__| \_______|\__|\__| \__| \__| \_______|  \____/
**/

// Helmet + Normal Shoes
encodeModel(
  "PL00P000.BIN",
  // Feet
  "miku/12_RIGHT_FOOT.obj",
  "miku/15_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET.obj",
);

// Helmet + Jet Skates
encodeModel(
  "PL00P001.BIN",
  // Feet
  "miku/20_JET_RIGHT_FOOT.obj",
  "miku/20_JET_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET.obj",
);

// Helmet + Hydojets
encodeModel(
  "PL00P002.BIN",
  // Feet
  "miku/20_HYDRO_RIGHT_FOOT.obj",
  "miku/20_HYDRO_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET.obj",
);

// Helmet + Asbestos
encodeModel(
  "PL00P003.BIN",
  // Feet
  "miku/20_ASBESTOS_RIGHT_FOOT.obj",
  "miku/20_ASBESTOS_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET.obj",
);

// Helmet + Cleated
encodeModel(
  "PL00P004.BIN",
  // Feet
  "miku/20_CLEATED_RIGHT_FOOT.obj",
  "miku/20_CLEATED_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET.obj",
);

// Helmet + Hover
encodeModel(
  "PL00P005.BIN",
  // Feet
  "miku/20_HOVER_RIGHT_FOOT.obj",
  "miku/20_HOVER_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET.obj",
);

/**
    $$\   $$\                 $$\   $$\           $$\                          $$\
    $$$\  $$ |                $$ |  $$ |          $$ |                         $$ |
    $$$$\ $$ | $$$$$$\        $$ |  $$ | $$$$$$\  $$ |$$$$$$\$$$$\   $$$$$$\ $$$$$$\
    $$ $$\$$ |$$  __$$\       $$$$$$$$ |$$  __$$\ $$ |$$  _$$  _$$\ $$  __$$\\_$$  _|
    $$ \$$$$ |$$ /  $$ |      $$  __$$ |$$$$$$$$ |$$ |$$ / $$ / $$ |$$$$$$$$ | $$ |
    $$ |\$$$ |$$ |  $$ |      $$ |  $$ |$$   ____|$$ |$$ | $$ | $$ |$$   ____| $$ |$$\
    $$ | \$$ |\$$$$$$  |      $$ |  $$ |\$$$$$$$\ $$ |$$ | $$ | $$ |\$$$$$$$\  \$$$$  |
    \__|  \__| \______/       \__|  \__| \_______|\__|\__| \__| \__| \_______|  \____/
**/

// No helmet + Normal Shoes
encodeModel(
  "PL00P010.BIN",
  // Feet
  "miku/12_RIGHT_FOOT.obj",
  "miku/15_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

// No helmet + Jet Skates
encodeModel(
  "PL00P011.BIN",
  // Feet
  "miku/20_JET_RIGHT_FOOT.obj",
  "miku/20_JET_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

// No helmet + Hydro Jets
encodeModel(
  "PL00P012.BIN",
  // Feet
  "miku/20_HYDRO_RIGHT_FOOT.obj",
  "miku/20_HYDRO_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

// No helmet + Asbestos Jets
encodeModel(
  "PL00P013.BIN",
  // Feet
  "miku/20_ASBESTOS_RIGHT_FOOT.obj",
  "miku/20_ASBESTOS_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

// No helmet + Cleated shoes
encodeModel(
  "PL00P014.BIN",
  // Feet
  "miku/20_CLEATED_RIGHT_FOOT.obj",
  "miku/20_CLEATED_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

// No helmet + Cleated shoes
encodeModel(
  "PL00P015.BIN",
  // Feet
  "miku/20_HOVER_RIGHT_FOOT.obj",
  "miku/20_HOVER_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

/**
    __                 _       _   __    __
    / _\_ __   ___  ___(_) __ _| | / / /\ \ \___  __ _ _ __   ___  _ __  ___
    \ \| '_ \ / _ \/ __| |/ _` | | \ \/  \/ / _ \/ _` | '_ \ / _ \| '_ \/ __|
    _\ \ |_) |  __/ (__| | (_| | |  \  /\  /  __/ (_| | |_) | (_) | | | \__ \
    \__/ .__/ \___|\___|_|\__,_|_|   \/  \/ \___|\__,_| .__/ \___/|_| |_|___/
    |_|                                            |_|
**/

replaceCrusher("miku/weapons/PL00R02_001.obj");
replaceBusterCannon("miku/weapons/PL00R03_001.obj");
replaceHyperShell("miku/weapons/PL00R04_001.obj");
replaceHomingMissle("miku/weapons/PL00R05_001.obj");
replaceGroundCrawler("miku/weapons/PL00R06_001.obj");
replaceVacuumArm("miku/weapons/PL00R07_001.obj");
replaceReflectorArm("miku/weapons/PL00R08_001.obj");
replaceShieldArm("miku/weapons/PL00R09_001.obj");
replaceBladeArm("miku/weapons/PL00R0A_001.obj");
replaceShiningLaser("miku/weapons/PL00R0B_001.obj");
replaceMachineGunArm("miku/weapons/PL00R0C_001.obj");
replaceSpreadBuster("miku/weapons/PL00R0D_001.obj");
replaceAquaBlaster("miku/weapons/PL00R0E_001.obj");
replaceHunterSeeker("miku/weapons/PL00R0F_001.obj");
replaceDrillArm("miku/weapons/PL00R10_001.obj");

/**
 Encode Apron
**/

encodeApronMegaman();
updateST03T("miku/apron/body-01.png", "miku/faces/ST03T.png");
updateSceneModel();
updateDemoLogo("miku/title-smol.png");
updateFlutterPaintings(
  "miku/paintings/megaman-room.png",
  "miku/paintings/roll-room.png",
);
updateYosyonkePaintings("miku/paintings/room-203.png");
updateYosyonkePaintings2(
  "miku/paintings/comic-hero.png",
  "miku/paintings/bar-room.png",
);
updateYosyonkePaintings3("miku/paintings/tiger-room.png");

/**
 Encode Rom
**/

encodeRom();
