import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_RECENTLY_VIEWED_PRODUCTS = 10;

export interface RecentlyViewedEntry {
  productId: number;
  viewedAt: string;
}

interface RecentlyViewedStore {
  entries: RecentlyViewedEntry[];
  recordProductView: (productId: number) => void;
}

const sanitizeEntries = (value: unknown): RecentlyViewedEntry[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<number>();
  const entries: RecentlyViewedEntry[] = [];
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("productId" in item) ||
      !("viewedAt" in item)
    ) {
      continue;
    }

    const { productId, viewedAt } = item;
    if (
      typeof productId !== "number" ||
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      typeof viewedAt !== "string" ||
      !Number.isFinite(Date.parse(viewedAt)) ||
      seen.has(productId)
    ) {
      continue;
    }

    seen.add(productId);
    entries.push({ productId, viewedAt });
    if (entries.length === MAX_RECENTLY_VIEWED_PRODUCTS) break;
  }

  return entries;
};

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      entries: [],
      recordProductView: (productId) => {
        if (!Number.isSafeInteger(productId) || productId <= 0) return;

        set((state) => ({
          entries: [
            {
              productId,
              viewedAt: new Date().toISOString(),
            },
            ...state.entries.filter((entry) => entry.productId !== productId),
          ].slice(0, MAX_RECENTLY_VIEWED_PRODUCTS),
        }));
      },
    }),
    {
      name: "grevya-recently-viewed-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
      merge: (persistedState, currentState) => {
        const entries =
          typeof persistedState === "object" &&
          persistedState !== null &&
          "entries" in persistedState
            ? sanitizeEntries(persistedState.entries)
            : [];
        return { ...currentState, entries };
      },
    },
  ),
);
