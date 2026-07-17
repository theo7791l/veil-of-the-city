type Listener = (...args: any[]) => void;

export class EventBus {
  private listeners: Map<string, Listener[]> = new Map();

  on(event: string, listener: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Listener): void {
    const arr = this.listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  emit(event: string, ...args: any[]): void {
    const arr = this.listeners.get(event);
    if (arr) arr.slice().forEach(fn => fn(...args));
  }

  once(event: string, listener: Listener): void {
    const wrapper: Listener = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

export const eventBus = new EventBus();
