import { designUrls } from "./urls";

export const canvaTemplate = {
  url: designUrls.canvaTemplate,
  designId: "DAGlY0QolDE",
  name: "SCK-SM Templates - Instagram Post (4:5)",
  width: 1080,
  height: 1350,
  colors: {
    orange: "#f7941d",
    lightBlue: "#00aeef",
    mediumBlue: "#008abd",
    darkBlue: "#004d76",
    black: "#000000",
    white: "#ffffff"
  },
  fonts: {
    primary: "Asap",
    specialty: "Sketch Block Bold"
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700
  },
  layout: {
    photo: "fullBleedBackground",
    logo: "topRight",
    logoWidth: 132,
    logoHeight: 115,
    logoTop: 38,
    logoRight: 64,
    overlay: "bottomBlackGradient",
    topicHeading: "aboveLine",
    articleTitle: "belowLine",
    dividerColor: "#f7941d",
    highlightColor: "#00aeef",
    fontFace: "Asap",
    specialtyFontFace: "Sketch Block Bold"
  }
} as const;
