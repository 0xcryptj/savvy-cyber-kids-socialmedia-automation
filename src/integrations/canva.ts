export interface CanvaClient { createAutofill(input: { imageUrl?: string; topicHeading: string; articleTitle: string }): Promise<{ designId: string; url?: string }>; }
