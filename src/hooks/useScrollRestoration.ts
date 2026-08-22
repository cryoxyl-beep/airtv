import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') {
      const savedPosition = sessionStorage.getItem(`scroll-y-${location.key}`);
      if (savedPosition) {
        const y = parseInt(savedPosition, 10);
        
        // Try restoring right away
        window.scrollTo(0, y);
        
        // Setup an interval for async pages
        let attempts = 0;
        const interval = setInterval(() => {
          // If we haven't reached our target and the page is tall enough (or getting taller)
          if (window.scrollY !== y && document.body.scrollHeight >= y) {
            window.scrollTo(0, y);
          }
          attempts++;
          
          if (attempts > 20 || window.scrollY === y) { 
            clearInterval(interval);
          }
        }, 100);
        
        return () => clearInterval(interval);
      }
    } else {
      // New navigation: scroll to top
      window.scrollTo(0, 0);
    }
  }, [location, navigationType]);

  useEffect(() => {
    let timeoutId: any;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        sessionStorage.setItem(`scroll-y-${location.key}`, window.scrollY.toString());
        timeoutId = null;
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [location]);
}
