// Shared between the API routes and the UI so the category list only
// exists in one place — must match the public.community_category enum in
// supabase/migrations/0001_community_forum.sql exactly.
export const COMMUNITY_CATEGORIES = [
  { value: 'tech_hardware', label: 'Tech & Hardware' },
  { value: 'off_grid_nature', label: 'Off-Grid & Nature' },
  { value: 'diy_inventions', label: 'DIY & Inventions' },
  { value: 'cosmic_stargazing', label: 'Cosmic / Stargazing' },
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number]['value'];

export function isCommunityCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && COMMUNITY_CATEGORIES.some((c) => c.value === value);
}

export function categoryLabel(value: CommunityCategory): string {
  return COMMUNITY_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
