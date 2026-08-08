import { useEffect, useRef, useState } from 'react';

export default function AnimatedCounter({ value, duration = 800, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const startValRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const startVal = startValRef.current;
    const endVal = value;
    const start = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplay(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
      else startValRef.current = endVal;
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}
