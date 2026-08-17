export interface ContentGenerator {
  generate(article: { title: string; body: string }): Promise<unknown>;
}

export class OpenAIContentGenerator implements ContentGenerator {
  async generate(article: { title: string; body: string }): Promise<unknown> {
    if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API integration requires OPENAI_API_KEY");
    const { generateSocialPost } = await import("@/src/content/generate");
    return generateSocialPost({
      id: "openai",
      category: "blog",
      sourceUrl: "",
      canonicalUrl: "",
      title: article.title,
      excerpt: article.body,
      body: article.body,
      tags: [],
      publishedAt: new Date().toISOString()
    });
  }
}
