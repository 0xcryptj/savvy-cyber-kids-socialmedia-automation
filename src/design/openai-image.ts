import { DesignRenderer, RenderRequest, RenderedGraphic } from "./renderer";
export class OpenAIImageRenderer implements DesignRenderer { async render(_request: RenderRequest): Promise<RenderedGraphic> { throw new Error("OpenAI image generation is opt-in and not configured"); } }
