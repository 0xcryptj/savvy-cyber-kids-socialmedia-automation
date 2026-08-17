export interface ContentGenerator { generate(article: { title: string; body: string }): Promise<unknown>; }
export class OpenAIContentGenerator implements ContentGenerator { async generate(): Promise<unknown> { throw new Error("OpenAI API integration requires OPENAI_API_KEY"); } }
