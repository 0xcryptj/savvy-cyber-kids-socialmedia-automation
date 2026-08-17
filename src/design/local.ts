import { DesignRenderer, RenderRequest, RenderedGraphic } from "./renderer";
export class LocalRenderer implements DesignRenderer { async render(_request: RenderRequest): Promise<RenderedGraphic> { return { path: "/generated/placeholder.svg", provider: "local" }; } }
