import { useEffect, useState } from 'react';

export const usePrefersReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!window.matchMedia) {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event: MediaQueryListEvent): void => setPrefers(event.matches);

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return prefers;
};
