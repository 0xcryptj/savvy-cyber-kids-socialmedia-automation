export const contentRules = {
  hashtags: { generated: 2, required: ["#savvycyberkids", "#cyberhero"], total: 4 },
  design: { reuseArticleImage: true, preserveArticleTitle: true, generateTopicHeading: true },
  publishing: { defaultStatus: "PENDING_REVIEW", requireHumanApproval: true, autoPublish: false }
} as const;
