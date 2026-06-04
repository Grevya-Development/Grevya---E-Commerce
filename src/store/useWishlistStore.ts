import { create } from "zustand";

interface WishlistStore {
  items: string[];
  setItems: (items: string[]) => void;
  addItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
}

export const useWishlistStore = create<WishlistStore>((set) => ({
  items: [],

  setItems: (items) => set({ items }),

  addItem: (id) =>
    set((state) => ({
      items: [...state.items, id],
    })),

 removeItem: (id) =>
  set((state) => ({
    items: state.items.filter((x) => x !== id),
  })),

clearItems: () =>
  set({
    items: [],
  }),
}));