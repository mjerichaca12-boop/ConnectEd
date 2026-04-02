import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref and whether the element has entered the viewport.
 * Once visible it stays visible.
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

/**
 * Typewriter hook — cycles through an array of strings.
 */
export function useTypewriter(words, { speed = 80, deleteSpeed = 45, pause = 1800 } = {}) {
  const [display, setDisplay] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex % words.length];
    let timeout;

    if (!deleting && display === current) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && display === "") {
      setDeleting(false);
      setWordIndex((i) => (i + 1) % words.length);
    } else {
      timeout = setTimeout(() => {
        setDisplay(deleting ? current.slice(0, display.length - 1) : current.slice(0, display.length + 1));
      }, deleting ? deleteSpeed : speed);
    }
    return () => clearTimeout(timeout);
  }, [display, deleting, wordIndex, words, speed, deleteSpeed, pause]);

  return display;
}
