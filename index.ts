import { encodeModel } from './src/Encode';

// No helmet + Normal Shoes
encodeModel(
    "PL00P010.BIN",
    // Body Encoding
    "obj/02_BODY.obj",
    "obj/03_HIPS.obj",
    "obj/10_LEG_RIGHT_TOP.obj",
    "obj/11_LEG_RIGHT_BOTTOM.obj",
    "obj/13_LEG_LEFT_TOP.obj",
    "obj/14_LEG_LEFT_BOTTOM.obj",
    // Feet
    "obj/12_RIGHT_FOOT.obj",
    "obj/15_LEFT_FOOT.obj",
    // Left Arm
    "obj/07_LEFT_SHOULDER.obj",
    "obj/08_LEFT_ARM.obj",
    "obj/09_LEFT_HAND.obj",
    // Right Arm
    "obj/04_RIGHT_SHOULDER.obj",
    "obj/05_RIGHT_ARM.obj",
    "obj/06_RIGHT_HAND.obj",
    // Head
    "obj/01_HEAD_HAIR.obj",
    "obj/01_HEAD_FACE.obj",
    "obj/01_HEAD_MOUTH.obj"
)