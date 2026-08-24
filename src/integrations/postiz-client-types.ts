export type PostizIntegration = {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  profile?: string;
  disabled?: boolean;
  customer?: { id: string; name?: string } | null;
};
