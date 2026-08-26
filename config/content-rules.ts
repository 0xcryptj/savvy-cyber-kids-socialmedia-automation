export const contentRules = {
  hashtags: { generated: 2, required: ["#savvycyberkids", "#cyberhero"], total: 4 },
  // Caption plus hashtags is one string on the platform, and X counts all of it.
  // 280 is the tightest limit among the channels this dashboard exports to, so
  // it is the one generation writes to.
  caption: { platformLimit: 280, maxHashtagLength: 20 },
  design: { reuseArticleImage: true, preserveArticleTitle: true, generateTopicHeading: true },
  publishing: { defaultStatus: "PENDING_REVIEW", requireHumanApproval: true, autoPublish: false }
} as const;
