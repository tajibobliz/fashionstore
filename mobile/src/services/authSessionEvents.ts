type InvalidSessionListener = () => void;

const listeners = new Set<InvalidSessionListener>();

export function onInvalidAuthSession(listener: InvalidSessionListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitInvalidAuthSession() {
  listeners.forEach((listener) => listener());
}
