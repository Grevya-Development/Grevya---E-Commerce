import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProductProps } from '@/components/ProductCard';
import { getAvailableStock } from '@/lib/stock';

export interface CartItem extends ProductProps {
    quantity: number;
}

interface CartStore {
    items: CartItem[];
    userCarts: Record<string, CartItem[]>; // userId -> CartItem[]
    currentUserId: string | null;
    addItem: (item: ProductProps, quantity?: number) => Promise<{ ok: boolean; availableStock: number }>;
    removeItem: (id: any, variantId?: string) => void;
    updateQuantity: (id: any, quantity: number, variantId?: string) => Promise<{ ok: boolean; availableStock: number }>;
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
                const availableStock = await getAvailableStock(product.id, product.variant_id);
                if (quantity < 1 || availableStock < 1) return { ok: false, availableStock };
                let accepted = false;
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const existingItem = currentCart.find((item) => item.id === product.id && item.variant_id === product.variant_id);

                    if ((existingItem?.quantity || 0) + quantity > availableStock) return state;
                    accepted = true;

                    let updatedCart: CartItem[];
                    if (existingItem) {
                        updatedCart = currentCart.map((item) =>
                            item.id === product.id && item.variant_id === product.variant_id
                                ? { ...item, quantity: item.quantity + quantity }
                                : item
                        );
                    } else {
                        updatedCart = [...currentCart, { ...product, quantity }];
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
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const updatedCart = currentCart.filter((item) => item.id !== id || item.variant_id !== variantId);

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
                const currentItem = get().items.find((item) => item.id === id && item.variant_id === variantId);
                if (!currentItem) return { ok: false, availableStock: 0 };
                const availableStock = await getAvailableStock(currentItem.id, currentItem.variant_id);
                if (quantity > availableStock) return { ok: false, availableStock };
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const updatedCart = currentCart.map((item) =>
                        item.id === id && item.variant_id === variantId ? { ...item, quantity } : item
                    );

                    return {
                        items: updatedCart,
                        userCarts: {
                            ...state.userCarts,
                            [activeKey]: updatedCart,
                        },
                    };
                });
                return { ok: true, availableStock };
            },

            clearCart: () => {
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
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
                return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
            },

            validateCartStock: async () => {
                const checks = await Promise.all(get().items.map(async (item) => ({
                    id: item.id,
                    variantId: item.variant_id,
                    availableStock: await getAvailableStock(item.id, item.variant_id),
                })));
                const changed = checks.some((check) => {
                    const item = get().items.find((cartItem) => cartItem.id === check.id && cartItem.variant_id === check.variantId);
                    return item && item.quantity > check.availableStock;
                });
                if (!changed) return true;

                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const updatedCart = currentCart
                        .map((item) => {
                            const check = checks.find((entry) => entry.id === item.id && entry.variantId === item.variant_id);
                            return check ? { ...item, quantity: Math.min(item.quantity, check.availableStock) } : item;
                        })
                        .filter((item) => item.quantity > 0);
                    return { items: updatedCart, userCarts: { ...state.userCarts, [activeKey]: updatedCart } };
                });
                return false;
            },

            syncUserSession: async (userId) => {
                set((state) => {
                    const prevUserId = state.currentUserId;
                    if (userId === prevUserId) {
                        // Already synced
                        return {};
                    }

                    const nextUserKey = userId || 'guest';
                    // Extract guest items safely from userCarts or fallback to active items
                    let guestCart = state.userCarts['guest'] || (!prevUserId ? state.items : []) || [];
                    let userCart = state.userCarts[nextUserKey] || [];

                    // If transitioning from guest to logged-in user, merge guest items
                    if (userId && guestCart.length > 0) {
                        const merged = [...userCart];
                        guestCart.forEach((guestItem) => {
                            const existingIdx = merged.findIndex((item) => item.id === guestItem.id && item.variant_id === guestItem.variant_id);
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
            name: 'grevya-cart-storage-v2',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
