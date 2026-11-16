export function greet(name: string): string {
  return `Hello, ${name}! Welcome to spaetzle-glas.`;
}

if (process.env.NODE_ENV !== "test") {
  console.log(greet("World"));
}