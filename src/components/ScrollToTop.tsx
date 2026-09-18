import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const location = useLocation();
  const { pathname, search, state } = location;

  useLayoutEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    const restoreProductsScroll = state?.restoreProductsScroll === true;
    const scrollStorageKey = `products-scroll:${search}`;

    if (pathname === "/products") {
      if (restoreProductsScroll) {
        const savedPosition = sessionStorage.getItem(scrollStorageKey);

        if (savedPosition) {
          try {
            const { top, left } = JSON.parse(savedPosition) as {
              top: number;
              left: number;
            };

            window.scrollTo({ top, left, behavior: "auto" });
            sessionStorage.removeItem(scrollStorageKey);
            return;
          } catch {
            sessionStorage.removeItem(scrollStorageKey);
          }
        }
      }

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, state]);

  return null;
};

export default ScrollToTop;
