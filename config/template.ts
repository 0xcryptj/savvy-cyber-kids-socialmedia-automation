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
  layout: {
    photo: "fullBleedBackground",
    logo: "topRight",
    overlay: "bottomBlackGradient",
    topicHeading: "aboveLine",
    articleTitle: "belowLine",
    dividerColor: "#f7941d",
    highlightColor: "#00aeef",
    fontFace: "Asap"
  }
} as const;
