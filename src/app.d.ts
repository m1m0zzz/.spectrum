// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  // vite.config.ts の define で埋め込む、同梱している mediabunny の版
  const __MEDIABUNNY_VERSION__: string;

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
