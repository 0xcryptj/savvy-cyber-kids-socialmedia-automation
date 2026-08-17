export const sourceUrls = {
  blog: "https://savvycyberkids.org/tech-talk/blog/",
  newsFeed: "https://savvycyberkids.org/tech-talk/savvy-cyber-kids-news-feed/"
} as const;

export const designUrls = {
  canvaTemplate: "https://www.canva.com/design/DAGlY0QolDE/W2OZJohpR3FCSN7P9e__aw/edit"
} as const;

export const publishingUrls = {
  socialBee: "https://app.socialbee.com/",
  instagram: "https://www.instagram.com/savvycyberkids/",
  facebook: "https://www.facebook.com/pages/Savvy-Cyber-Kids/154999394976",
  linkedin: "https://www.linkedin.com/company/savvy-cyber-kids/",
  x: "https://x.com/savvycyberkids"
} as const;

export const workflowLinks = [
  { label: "Open Canva template", href: designUrls.canvaTemplate },
  { label: "Open SocialBee", href: publishingUrls.socialBee },
  { label: "Instagram", href: publishingUrls.instagram },
  { label: "Facebook", href: publishingUrls.facebook },
  { label: "LinkedIn", href: publishingUrls.linkedin },
  { label: "X", href: publishingUrls.x }
] as const;
