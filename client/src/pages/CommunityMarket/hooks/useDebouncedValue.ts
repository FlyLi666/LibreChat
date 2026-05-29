import { useEffect, useState } from 'react';

export default function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  return debounced;
}
