import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ProductProps } from "@/components/ProductCard";

interface WishlistStore {
  items: ProductProps[];
  userWishlists: Record<string, ProductProps[]>; // userId -> ProductProps[]
  currentUserId: string | null;
  toggleWishlist: (item: ProductProps) => boolean; // returns true if added, false if removed
  isInWishlist: (id: any) => boolean;
  clearWishlist: () => void;
  syncUserSession: (userId: string | null) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      userWishlists: {},
      currentUserId: null,

      toggleWishlist: (product) => {
        // Prevent toggling wishlist for unauthenticated users.
        const activeKey = get().currentUserId;
        if (!activeKey) {
          return false;
        }

        let added = false;
        set((state) => {
          const currentWishlist = state.userWishlists[activeKey] || [];
          const existingItem = currentWishlist.find(
            (item) => item.id === product.id,
          );

          let updatedWishlist: ProductProps[];
          if (existingItem) {
            updatedWishlist = currentWishlist.filter(
              (item) => item.id !== product.id,
            );
            added = false;
          } else {
            updatedWishlist = [...currentWishlist, product];
            added = true;
          }

          return {
            items: updatedWishlist,
            userWishlists: {
              ...state.userWishlists,
              [activeKey]: updatedWishlist,
            },
          };
        });
        return added;
      },

      isInWishlist: (id) => {
        return get().items.some((item) => item.id === id);
      },

      clearWishlist: () => {
        set((state) => {
          const activeKey = state.currentUserId || "guest";
          return {
            items: [],
            userWishlists: {
              ...state.userWishlists,
              [activeKey]: [],
            },
          };
        });
      },

      syncUserSession: (userId) => {
        set((state) => {
          const prevUserId = state.currentUserId;
          if (userId === prevUserId) {
            return {};
          }

          // Do not maintain a guest wishlist; only load user wishlists when authenticated.
          const userWishlist = userId ? state.userWishlists[userId] || [] : [];

          return {
            currentUserId: userId,
            items: userWishlist,
            userWishlists: {
              ...state.userWishlists,
              ...(userId ? { [userId]: userWishlist } : {}),
            },
          };
        });
      },
    }),
    {
      name: "grevya-wishlist-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
