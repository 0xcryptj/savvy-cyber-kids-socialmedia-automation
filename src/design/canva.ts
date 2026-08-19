import { CanvaClient } from "@/src/integrations/canva";
import { designUrls } from "@/config/urls";
import { canvaTemplate } from "@/config/template";

export const canvaClient: CanvaClient = {
  async createAutofill(input) {
    return { designId: canvaTemplate.designId, url: designUrls.canvaTemplate, ...input };
  }
};
