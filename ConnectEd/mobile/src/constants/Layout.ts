import { Dimensions } from "react-native";

const width = Dimensions.get("window").width;
const height = Dimensions.get("window").height;

export default {
    window: {
        width,
        height,
    },
    isSmallDevice: width < 375,
    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
    },
    borderRadius: {
        s: 4,
        m: 8,
        l: 12,
        xl: 20,
    },
};
