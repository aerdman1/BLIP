/**
 * Singleton event bus shared between Phaser scenes, HTML shell, Command Center
 * and the Test API. Deliberately dependency-free (no Phaser import) so the
 * shell code stays decoupled from the engine bundle graph.
 */

type Handler = (...args: unknown[]) => void;

class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }

  once(event: string, fn: Handler): void {
    const wrap: Handler = (...args) => {
      this.off(event, wrap);
      fn(...args);
    };
    this.on(event, wrap);
  }

  off(event: string, fn: Handler): void {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // copy so handlers can unsubscribe during emit
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (err) {
        // one broken listener must never take down the game loop
        console.error(`[BLIP bus] handler error on "${event}"`, err);
      }
    }
  }
}

export const bus = new EventBus();
