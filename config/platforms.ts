import { publishingUrls } from "./urls";

export const socialPlatforms = [
  { id: "instagram", label: "Instagram", href: publishingUrls.instagram },
  { id: "facebook", label: "Facebook", href: publishingUrls.facebook },
  { id: "linkedin", label: "LinkedIn", href: publishingUrls.linkedin },
  { id: "x", label: "X", href: publishingUrls.x }
] as const;
