import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    if (navigationType === 'POP') {
      const savedPosition = sessionStorage.getItem(`scroll-y-${location.key}`);
      if (savedPosition) {
        const y = parseInt(savedPosition, 10);
        window.scrollTo(0, y);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key, navigationType]);

  useEffect(() => {
    let timeoutId: any;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        sessionStorage.setItem(`scroll-y-${location.key}`, window.scrollY.toString());
        timeoutId = null;
      }, 200);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [location.key]);
}
