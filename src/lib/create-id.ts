export function createId(): string {
  const random = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(random, (value) => value.toString(16).padStart(8, "0")).join("");
}
