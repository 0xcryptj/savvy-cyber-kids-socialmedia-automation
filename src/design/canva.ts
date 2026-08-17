import { CanvaClient } from "@/src/integrations/canva";
import { designUrls } from "@/config/urls";
import { canvaTemplate } from "@/config/template";

export class CanvaRenderer {
  async render(request: { imageUrl?: string; topicHeading: string; articleTitle: string }) {
    return {
      path: `/api/graphic?heading=${encodeURIComponent(request.topicHeading)}&title=${encodeURIComponent(request.articleTitle)}&image=${encodeURIComponent(request.imageUrl ?? "")}`,
      provider: "local" as const,
      templateUrl: canvaTemplate.url
    };
  }
}

export const canvaClient: CanvaClient = {
  async createAutofill(input) {
    return { designId: canvaTemplate.designId, url: designUrls.canvaTemplate, ...input };
  }
};
