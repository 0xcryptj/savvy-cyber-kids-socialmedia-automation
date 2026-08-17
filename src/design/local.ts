import { DesignRenderer, RenderRequest, RenderedGraphic } from "./renderer";
import { CanvaRenderer } from "./canva";

export class LocalRenderer implements DesignRenderer {
  async render(request: RenderRequest): Promise<RenderedGraphic> {
    const rendered = await new CanvaRenderer().render(request);
    return { path: rendered.path, provider: "local" };
  }
}
