export async function processArticle(articleId: string): Promise<{ articleId: string; status: "PENDING_REVIEW" }> { return { articleId, status: "PENDING_REVIEW" }; }
