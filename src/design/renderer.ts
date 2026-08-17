export type RenderRequest = { articleImage?: string; topicHeading: string; articleTitle: string };
export type RenderedGraphic = { path: string; provider: "local" | "canva" | "openai" };
export interface DesignRenderer { render(request: RenderRequest): Promise<RenderedGraphic>; }
