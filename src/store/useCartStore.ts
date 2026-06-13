import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProductProps } from '@/components/ProductCard';

export interface CartItem extends ProductProps {
    quantity: number;
}

interface CartStore {
    items: CartItem[];
    userCarts: Record<string, CartItem[]>; // userId -> CartItem[]
    currentUserId: string | null;
    addItem: (item: ProductProps, quantity?: number) => void;
    removeItem: (id: any) => void;
    updateQuantity: (id: any, quantity: number) => void;
    clearCart: () => void;
    getTotalItems: () => number;
    getSubtotal: () => number;
    syncUserSession: (userId: string | null) => void;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            userCarts: {},
            currentUserId: null,

            addItem: (product, quantity = 1) => {
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const existingItem = currentCart.find((item) => item.id === product.id);

                    let updatedCart: CartItem[];
                    if (existingItem) {
                        updatedCart = currentCart.map((item) =>
                            item.id === product.id
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
            },

            removeItem: (id) => {
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const updatedCart = currentCart.filter((item) => item.id !== id);

                    return {
                        items: updatedCart,
                        userCarts: {
                            ...state.userCarts,
                            [activeKey]: updatedCart,
                        },
                    };
                });
            },

            updateQuantity: (id, quantity) => {
                if (quantity < 1) return;
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentCart = state.userCarts[activeKey] || [];
                    const updatedCart = currentCart.map((item) =>
                        item.id === id ? { ...item, quantity } : item
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

            syncUserSession: (userId) => {
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
                            const existingIdx = merged.findIndex((item) => item.id === guestItem.id);
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
            },
        }),
        {
            name: 'grevya-cart-storage-v2',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
