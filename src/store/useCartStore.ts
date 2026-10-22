import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ProductProps } from "@/components/ProductCard";
import { getAvailableStock } from "@/lib/stock";

export interface CartItem extends ProductProps {
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  userCarts: Record<string, CartItem[]>; // userId -> CartItem[]
  currentUserId: string | null;
  addItem: (
    item: ProductProps,
    quantity?: number,
  ) => Promise<{ ok: boolean; availableStock: number }>;
  removeItem: (id: any, variantId?: string) => void;
  updateQuantity: (
    id: any,
    quantity: number,
    variantId?: string,
  ) => Promise<{ ok: boolean; availableStock: number }>;
  adjustQuantity: (
    id: any,
    delta: number,
    variantId?: string,
  ) => Promise<{ ok: boolean; availableStock: number }>;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  validateCartStock: () => Promise<boolean>;
  syncUserSession: (userId: string | null) => Promise<void>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      userCarts: {},
      currentUserId: null,

      addItem: async (product, quantity = 1) => {
        if (quantity < 1) return { ok: false, availableStock: 0 };
        const availableStock = await getAvailableStock(
          product.id,
          product.variant_id,
        );
        let accepted = false;
        set((state) => {
          const activeKey = state.currentUserId || "guest";
          const currentCart = state.userCarts[activeKey] || [];
          const existingItem = currentCart.find(
            (item) =>
              item.id === product.id && item.variant_id === product.variant_id,
          );

          let updatedCart: CartItem[];
          if (existingItem) {
            if (availableStock < 1) {
              updatedCart = currentCart.filter(
                (item) =>
                  item.id !== product.id ||
                  item.variant_id !== product.variant_id,
              );
            } else {
              const nextQuantity =
                existingItem.quantity + quantity <= availableStock
                  ? existingItem.quantity + quantity
                  : Math.min(existingItem.quantity, availableStock);
              accepted = nextQuantity === existingItem.quantity + quantity;
              updatedCart = currentCart.map((item) =>
                item.id === product.id && item.variant_id === product.variant_id
                  ? { ...item, quantity: nextQuantity, stock: availableStock }
                  : item,
              );
            }
          } else {
            if (availableStock < 1 || quantity > availableStock) {
              return state;
            }
            accepted = true;
            updatedCart = [
              ...currentCart,
              { ...product, quantity, stock: availableStock },
            ];
          }

          return {
            items: updatedCart,
            userCarts: {
              ...state.userCarts,
              [activeKey]: updatedCart,
            },
          };
        });
        return { ok: accepted, availableStock };
      },

      removeItem: (id, variantId) => {
        set((state) => {
          const activeKey = state.currentUserId || "guest";
          const currentCart = state.userCarts[activeKey] || [];
          const updatedCart = currentCart.filter(
            (item) => item.id !== id || item.variant_id !== variantId,
          );

          return {
            items: updatedCart,
            userCarts: {
              ...state.userCarts,
              [activeKey]: updatedCart,
            },
          };
        });
      },

      updateQuantity: async (id, quantity, variantId) => {
        if (quantity < 1) return { ok: false, availableStock: 0 };
        const currentItem = get().items.find(
          (item) => item.id === id && item.variant_id === variantId,
        );
        if (!currentItem) return { ok: false, availableStock: 0 };
        const availableStock = await getAvailableStock(
          currentItem.id,
          currentItem.variant_id,
        );
        let accepted = false;
        set((state) => {
          const activeKey = state.currentUserId || "guest";
          const currentCart = state.userCarts[activeKey] || [];
          const latestItem = currentCart.find(
            (item) => item.id === id && item.variant_id === variantId,
          );
          if (!latestItem) return state;

          const updatedCart =
            availableStock < 1
              ? currentCart.filter(
                  (item) =>
                    item.id !== id || item.variant_id !== variantId,
                )
              : currentCart.map((item) => {
                  if (item.id !== id || item.variant_id !== variantId)
                    return item;
                  const nextQuantity =
                    quantity <= availableStock
                      ? quantity
                      : Math.min(latestItem.quantity, availableStock);
                  accepted = quantity <= availableStock;
                  return {
                    ...item,
                    quantity: nextQuantity,
                    stock: availableStock,
                  };
                });

          return {
            items: updatedCart,
            userCarts: {
              ...state.userCarts,
              [activeKey]: updatedCart,
            },
          };
        });
        return { ok: accepted, availableStock };
      },

      adjustQuantity: async (id, delta, variantId) => {
        if (delta === 0) return { ok: false, availableStock: 0 };
        let accepted = false;
        let availableStock = 0;
        set((state) => {
          const activeKey = state.currentUserId || "guest";
          const currentCart = state.userCarts[activeKey] || [];
          const currentItem = currentCart.find(
            (item) => item.id === id && item.variant_id === variantId,
          );
          if (!currentItem) return state;

          availableStock = Number.isFinite(currentItem.stock)
            ? Math.max(0, Number(currentItem.stock))
            : 0;
          if (availableStock < 1) {
            return {
              items: currentCart.filter(
                (item) =>
                  item.id !== id || item.variant_id !== variantId,
              ),
              userCarts: {
                ...state.userCarts,
                [activeKey]: currentCart.filter(
                  (item) =>
                    item.id !== id || item.variant_id !== variantId,
                ),
              },
            };
          }

          const updatedCart =
            currentCart.map((item) => {
              if (item.id !== id || item.variant_id !== variantId)
                return item;
              const currentQuantity = Math.min(
                currentItem.quantity,
                availableStock,
              );
              const nextQuantity = currentQuantity + delta;
              if (nextQuantity < 1 || nextQuantity > availableStock) {
                return {
                  ...item,
                  quantity: currentQuantity,
                  stock: availableStock,
                };
              }
              accepted = true;
              return {
                ...item,
                quantity: nextQuantity,
                stock: availableStock,
              };
            });

          return {
            items: updatedCart,
            userCarts: {
              ...state.userCarts,
              [activeKey]: updatedCart,
            },
          };
        });

        return { ok: accepted, availableStock };
      },

      clearCart: () => {
        set((state) => {
          const activeKey = state.currentUserId || "guest";
          return {
            items: [],
            userCarts: {
              ...state.userCarts,
              [activeKey]: [],
            },
          };
        });
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );
      },

      validateCartStock: async () => {
        const itemsToCheck = get().items;
        const checks = await Promise.all(
          itemsToCheck.map(async (item) => ({
            id: item.id,
            variantId: item.variant_id,
            availableStock: await getAvailableStock(item.id, item.variant_id),
          })),
        );
        const changed = checks.some((check) => {
          const item = get().items.find(
            (cartItem) =>
              cartItem.id === check.id &&
              cartItem.variant_id === check.variantId,
          );
          return item && item.quantity > check.availableStock;
        });

        set((state) => {
          const activeKey = state.currentUserId || "guest";
          const currentCart = state.userCarts[activeKey] || [];
          const updatedCart = currentCart
            .map((item) => {
              const check = checks.find(
                (entry) =>
                  entry.id === item.id && entry.variantId === item.variant_id,
              );
              return check
                ? {
                    ...item,
                    quantity: Math.min(item.quantity, check.availableStock),
                    stock: check.availableStock,
                  }
                : item;
            })
            .filter((item) => item.quantity > 0);
          return {
            items: updatedCart,
            userCarts: { ...state.userCarts, [activeKey]: updatedCart },
          };
        });
        return !changed;
      },

      syncUserSession: async (userId) => {
        set((state) => {
          const prevUserId = state.currentUserId;
          if (userId === prevUserId) {
            // Already synced
            return {};
          }

          const nextUserKey = userId || "guest";
          // Extract guest items safely from userCarts or fallback to active items
          let guestCart =
            state.userCarts["guest"] || (!prevUserId ? state.items : []) || [];
          let userCart = state.userCarts[nextUserKey] || [];

          // If transitioning from guest to logged-in user, merge guest items
          if (userId && guestCart.length > 0) {
            const merged = [...userCart];
            guestCart.forEach((guestItem) => {
              const existingIdx = merged.findIndex(
                (item) =>
                  item.id === guestItem.id &&
                  item.variant_id === guestItem.variant_id,
              );
              if (existingIdx !== -1) {
                merged[existingIdx].quantity += guestItem.quantity;
              } else {
                merged.push({ ...guestItem });
              }
            });
            userCart = merged;
            guestCart = []; // Flush guest cart upon merging
          }

          // Active items should reflect the current user session's cart
          const activeItems = userId ? userCart : guestCart;

          return {
            currentUserId: userId,
            items: activeItems,
            userCarts: {
              ...state.userCarts,
              guest: guestCart,
              ...(userId ? { [userId]: userCart } : {}),
            },
          };
        });
        await get().validateCartStock();
      },
    }),
    {
      name: "grevya-cart-storage-v2",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
