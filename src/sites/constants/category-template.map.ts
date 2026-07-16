export type TemplateId =
  | 'template-trades'
  | 'template-beauty'
  | 'template-food'
  | 'template-auto'
  | 'template-home';

/**
 * Ordered keyword → template map. A lead's category is matched (case-insensitive
 * substring) against these keywords; the first match wins. Order matters where
 * keywords could overlap.
 */
export const CATEGORY_TEMPLATE_MAP: ReadonlyArray<readonly [string, TemplateId]> = [
  // trades
  ['plumb', 'template-trades'],
  ['electric', 'template-trades'],
  ['hvac', 'template-trades'],
  ['heating', 'template-trades'],
  ['air condition', 'template-trades'],
  ['handyman', 'template-trades'],
  ['contractor', 'template-trades'],
  // beauty
  ['salon', 'template-beauty'],
  ['barber', 'template-beauty'],
  ['spa', 'template-beauty'],
  ['nail', 'template-beauty'],
  ['hair', 'template-beauty'],
  ['beauty', 'template-beauty'],
  // food
  ['restaurant', 'template-food'],
  ['cafe', 'template-food'],
  ['coffee', 'template-food'],
  ['bakery', 'template-food'],
  ['cater', 'template-food'],
  ['pizza', 'template-food'],
  ['food', 'template-food'],
  // auto
  ['auto', 'template-auto'],
  ['car repair', 'template-auto'],
  ['car wash', 'template-auto'],
  ['detail', 'template-auto'],
  ['tow', 'template-auto'],
  ['mechanic', 'template-auto'],
  ['tire', 'template-auto'],
  // home
  ['landscap', 'template-home'],
  ['lawn', 'template-home'],
  ['clean', 'template-home'],
  ['pest', 'template-home'],
  ['roof', 'template-home'],
  ['garden', 'template-home'],
];

export const DEFAULT_TEMPLATE: TemplateId = 'template-trades';

/** Resolves the best template for a lead category, defaulting to trades. */
export function resolveTemplate(category: string | null | undefined): TemplateId {
  const c = (category ?? '').toLowerCase();
  for (const [keyword, template] of CATEGORY_TEMPLATE_MAP) {
    if (c.includes(keyword)) return template;
  }
  return DEFAULT_TEMPLATE;
}
