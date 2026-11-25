// Tiny stack of "close me" handlers so the Android back button closes the top-most sheet first.
type Handler = () => void;
const stack: Handler[] = [];

export function pushBack(h: Handler): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Runs the top handler. Returns false when there was nothing to close. */
export function popBack(): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
