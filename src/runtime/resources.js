export function stopInterval(handle) {
  if (handle !== null && handle !== undefined) clearInterval(handle);
  return null;
}

export function stopTimeout(handle) {
  if (handle !== null && handle !== undefined) clearTimeout(handle);
  return null;
}

export function stopSubscription(unsubscribe) {
  if (typeof unsubscribe === "function") unsubscribe();
  return null;
}
