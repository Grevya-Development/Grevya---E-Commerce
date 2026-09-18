export interface SearchableProduct {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  keywords?: string[] | string | null;
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSearchTokens = (value: string) =>
  value.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const getSearchText = (value: string | string[] | null | undefined) =>
  Array.isArray(value) ? value.join(" ") : (value ?? "");

const hasStandaloneTerm = (
  value: string | string[] | null | undefined,
  term: string,
) => {
  const source = getSearchText(value).toLowerCase();
  if (!source || !term) return false;

  const escapedTerm = escapeRegExp(term.toLowerCase());
  return new RegExp(`(^|\\s)${escapedTerm}(?=\\s|$)`, "i").test(source);
};

const broadConsumableTerms = new Set([
  "food",
  "tea",
  "tulsi",
  "herbal",
  "powder",
  "oil",
  "honey",
  "seed",
  "seeds",
  "spice",
  "spices",
  "leaf",
  "leaves",
  "botanical",
  "coconut",
  "turmeric",
  "cinnamon",
  "cardamom",
  "moringa",
  "lavender",
  "eucalyptus",
  "ayurvedic",
  "adaptogen",
  "capsule",
  "capsules",
  "blend",
  "herb",
  "herbs",
  "essential",
  "organic",
  "loose",
]);

const includesSearchTerms = (
  value: string | string[] | null | undefined,
  terms: string[],
) => {
  const source = getSearchText(value);
  return terms.every((term) => hasStandaloneTerm(source, term));
};

const includesAnySearchTerm = (
  value: string | string[] | null | undefined,
  terms: string[],
) => {
  const source = getSearchText(value);
  return terms.some((term) => hasStandaloneTerm(source, term));
};

const getExpandedQueryTerms = (query: string) => {
  const rawTerms = getSearchTokens(query);
  const expanded = new Set(rawTerms);

  for (const term of rawTerms) {
    if (
      term === "food" ||
      term === "consumable" ||
      term === "pantry" ||
      term === "tea" ||
      term === "oil" ||
      term === "spice" ||
      term === "snack" ||
      term === "herb"
    ) {
      for (const consumableTerm of broadConsumableTerms) {
        expanded.add(consumableTerm);
      }
    }
  }

  return [...expanded];
};

const getBroadProductMatch = (product: SearchableProduct, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  const expandedTerms = getExpandedQueryTerms(normalizedQuery);
  if (!expandedTerms.length) return false;

  const searchableFields = [
    product.name,
    product.category,
    product.subcategory,
    product.description,
    product.tags,
    product.keywords,
  ];

  return searchableFields.some((field) =>
    includesAnySearchTerm(field, expandedTerms),
  );
};

export const getProductSearchScore = (
  product: SearchableProduct,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  const terms = getSearchTokens(normalizedQuery);
  if (!terms.length) return 0;

  const name = product.name ?? "";
  const category = product.category ?? "";
  const tags = [product.tags, product.keywords];

  if (name.toLowerCase() === normalizedQuery) return 100;
  if (includesSearchTerms(name, terms)) return 90;
  if (name.toLowerCase().includes(normalizedQuery)) return 80;
  if (includesSearchTerms(category, terms)) return 60;
  if (includesSearchTerms(product.subcategory, terms)) return 50;
  if (tags.some((tag) => includesSearchTerms(tag, terms))) return 40;

  if (
    terms.length > 1 &&
    normalizedQuery.length >= 4 &&
    includesSearchTerms(product.description, terms)
  ) {
    return 20;
  }

  const descriptionStandaloneMatch =
    product.description &&
    terms.some((term) => hasStandaloneTerm(product.description, term));

  if (normalizedQuery.length >= 4 && descriptionStandaloneMatch) {
    return 15;
  }

  const broadMatch = getBroadProductMatch(product, normalizedQuery);
  if (broadMatch) return 12;

  const partialDescriptionMatch =
    normalizedQuery.length >= 3 &&
    product.description &&
    hasStandaloneTerm(product.description, normalizedQuery);

  return partialDescriptionMatch ? 10 : 0;
};

export const searchProducts = <T extends SearchableProduct>(
  products: T[],
  query: string,
) =>
  products
    .map((product) => ({
      product,
      score: getProductSearchScore(product, query),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.product.name ?? "").localeCompare(b.product.name ?? ""),
    )
    .map(({ product }) => product);
