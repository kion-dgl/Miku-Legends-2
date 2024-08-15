import { encodeModel } from "./src/EncodeModel";
import { encodeTexture } from "./src/EncodeTexture";
import { encodeRom } from "./src/EncodeRom";
import { replaceShieldArm } from "./src/EncodeWeapon";

// Encode the Texture
encodeTexture(
  // Body Texture
  "miku/miku_body.png",
  // Face Texture
  "miku/face-1.png",
  // Special Weapon
  "miku/megaman_img_002.png",
  // "miku/debug.png",
);

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

replaceShieldArm("miku/weapons/PL00R0A_001.obj");

/**
 Encode Rom
**/

encodeRom();
