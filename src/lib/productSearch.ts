export interface SearchableProduct {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  keywords?: string[] | string | null;
}

const getSearchTokens = (value: string) =>
  value.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const getSearchText = (value: string | string[] | null | undefined) =>
  Array.isArray(value) ? value.join(' ') : value ?? '';

const includesSearchTerms = (
  value: string | string[] | null | undefined,
  terms: string[],
) => {
  const tokens = new Set(getSearchTokens(getSearchText(value)));
  return terms.every((term) => tokens.has(term));
};

export const getProductSearchScore = (
  product: SearchableProduct,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  const terms = getSearchTokens(normalizedQuery);
  if (!terms.length) return 0;

  const name = product.name ?? '';
  const category = product.category ?? '';
  const tags = [product.tags, product.keywords];

  if (name.toLowerCase() === normalizedQuery) return 100;
  if (includesSearchTerms(name, terms)) return 90;
  if (name.toLowerCase().includes(normalizedQuery)) return 80;
  if (includesSearchTerms(category, terms)) return 60;
  if (includesSearchTerms(product.subcategory, terms)) return 50;
  if (tags.some((tag) => includesSearchTerms(tag, terms))) return 40;

  // Short terms in descriptions are often incidental (for example, “tea tree oil”).
  return normalizedQuery.length >= 4 && includesSearchTerms(product.description, terms)
    ? 20
    : 0;
};

export const searchProducts = <T extends SearchableProduct>(
  products: T[],
  query: string,
) =>
  products
    .map((product) => ({ product, score: getProductSearchScore(product, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.product.name ?? '').localeCompare(b.product.name ?? ''))
    .map(({ product }) => product);
