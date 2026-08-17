import { DesignRenderer, RenderRequest, RenderedGraphic } from "./renderer";
export class CanvaRenderer implements DesignRenderer { async render(_request: RenderRequest): Promise<RenderedGraphic> { throw new Error("Canva renderer is not configured: template access is pending"); } }
