import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_COMPARISON_PRODUCTS = 3;

type AddComparisonResult = "added" | "already-selected" | "limit-reached";

interface ComparisonStore {
  selectedIds: number[];
  addProduct: (id: number) => AddComparisonResult;
  removeProduct: (id: number) => void;
  clearProducts: () => void;
}

export const useComparisonStore = create<ComparisonStore>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      addProduct: (id) => {
        const selectedIds = get().selectedIds;
        if (selectedIds.includes(id)) return "already-selected";
        if (selectedIds.length >= MAX_COMPARISON_PRODUCTS) {
          return "limit-reached";
        }

        set({ selectedIds: [...selectedIds, id] });
        return "added";
      },
      removeProduct: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.filter(
            (selectedId) => selectedId !== id,
          ),
        })),
      clearProducts: () => set({ selectedIds: [] }),
    }),
    {
      name: "grevya-comparison-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedIds: state.selectedIds }),
    },
  ),
);
