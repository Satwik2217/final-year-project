import { useState, useEffect } from 'react';

export function useTypewriter(text, active, speed = 18) {
  const [displayed, setDisplayed] = useState(active ? '' : text);
  const [done, setDone] = useState(!active);

  useEffect(() => {
    if (!active) {
      setDisplayed(text);
      setDone(true);
      return;
    }

    setDisplayed('');
    setDone(false);
    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, active, speed]);

  return { displayed, done };
}
