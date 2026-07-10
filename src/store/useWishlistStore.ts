import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProductProps } from '@/components/ProductCard';

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
                let added = false;
                set((state) => {
                    const activeKey = state.currentUserId || 'guest';
                    const currentWishlist = state.userWishlists[activeKey] || [];
                    const existingItem = currentWishlist.find((item) => item.id === product.id);

                    let updatedWishlist: ProductProps[];
                    if (existingItem) {
                        updatedWishlist = currentWishlist.filter((item) => item.id !== product.id);
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
                    const activeKey = state.currentUserId || 'guest';
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

                    const nextUserKey = userId || 'guest';
                    let guestWishlist = state.userWishlists['guest'] || (!prevUserId ? state.items : []) || [];
                    let userWishlist = state.userWishlists[nextUserKey] || [];

                    // Merge guest wishlist into user wishlist on login
                    if (userId && guestWishlist.length > 0) {
                        const merged = [...userWishlist];
                        guestWishlist.forEach((guestItem) => {
                            if (!merged.some((item) => item.id === guestItem.id)) {
                                merged.push({ ...guestItem });
                            }
                        });
                        userWishlist = merged;
                        guestWishlist = []; // flush guest wishlist
                    }

                    const activeItems = userId ? userWishlist : guestWishlist;

                    return {
                        currentUserId: userId,
                        items: activeItems,
                        userWishlists: {
                            ...state.userWishlists,
                            guest: guestWishlist,
                            ...(userId ? { [userId]: userWishlist } : {}),
                        },
                    };
                });
            },
        }),
        {
            name: 'grevya-wishlist-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
