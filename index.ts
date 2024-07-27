import { encodeModel } from "./src/EncodeModel";
import { encodeTexture } from "./src/EncodeTexture";
import { encodeRom } from "./src/EncodeRom";

// Encode the Texture
encodeTexture(
  // Body Texture
  "miku/miku_body.png",
  // Face Texture
  "miku/face-1.png",
);

// Helmet + Normal Shoes
encodeModel(
  "PL00P000.BIN",
  // Feet
  "miku/12_RIGHT_FOOT.obj",
  "miku/15_LEFT_FOOT.obj",
  // Head
  "miku/10_HELMET-tails.obj",
);

// No helmet + Normal Shoes
encodeModel(
  "PL00P010.BIN",
  // Feet
  "miku/12_RIGHT_FOOT.obj",
  "miku/15_LEFT_FOOT.obj",
  // Head
  "miku/01_HEAD_HAIR.obj",
);

encodeRom();
