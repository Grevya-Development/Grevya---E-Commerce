import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Resets the window position when navigating to a different route. */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
