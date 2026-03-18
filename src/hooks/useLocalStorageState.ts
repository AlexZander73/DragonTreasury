import { useEffect, useState } from 'react';

export const useLocalStorageState = <T,>(key: string, initialValue: T): [T, (value: T) => void] => {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) {
        return initialValue;
      }
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore write failures in strict privacy contexts.
    }
  }, [key, state]);

  return [state, setState];
};
