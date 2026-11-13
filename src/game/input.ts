export interface InputCallbacks {
  onPressStart: (source: 'pointer' | 'key') => void;
  onPressEnd: (source: 'pointer' | 'key') => void;
  onShield: () => void;
  onDiveKey: (down: boolean) => void;
}

/** Unifica toque, mouse e teclado com detecção de swipe-up (one-thumb). */
export class InputController {
  private el: HTMLElement;
  private cb: InputCallbacks;
  private pointerActive = false;
  private startY = 0;
  private startT = 0;
  private swipeFired = false;
  private keyHeld = new Set<string>();
  private readonly disposers: Array<() => void> = [];

  constructor(el: HTMLElement, cb: InputCallbacks) {
    this.el = el;
    this.cb = cb;

    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.pointerActive = true;
      this.swipeFired = false;
      this.startY = e.clientY;
      this.startT = performance.now();
      this.el.setPointerCapture?.(e.pointerId);
      this.cb.onPressStart('pointer');
    };
    const onMove = (e: PointerEvent): void => {
      if (!this.pointerActive || this.swipeFired) return;
      const dy = e.clientY - this.startY;
      const dt = performance.now() - this.startT;
      if (dy < -48 && dt < 600) {
        this.swipeFired = true;
        this.cb.onShield();
      }
    };
    const onUp = (): void => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      this.cb.onPressEnd('pointer');
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const code = e.code;
      if (code === 'Space' || code === 'Enter') {
        e.preventDefault();
        if (!this.keyHeld.has(code)) {
          this.keyHeld.add(code);
          this.cb.onPressStart('key');
        }
      } else if (code === 'ArrowUp' || code === 'KeyW') {
        e.preventDefault();
        this.cb.onShield();
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        e.preventDefault();
        this.cb.onDiveKey(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      const code = e.code;
      if (code === 'Space' || code === 'Enter') {
        if (this.keyHeld.delete(code)) this.cb.onPressEnd('key');
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        this.cb.onDiveKey(false);
      }
    };

    const onContextMenu = (e: Event): void => {
      e.preventDefault();
    };

    this.el.addEventListener('pointerdown', onDown);
    this.el.addEventListener('pointermove', onMove);
    this.el.addEventListener('pointerup', onUp);
    this.el.addEventListener('pointercancel', onUp);
    this.el.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.disposers.push(() => {
      this.el.removeEventListener('pointerdown', onDown);
      this.el.removeEventListener('pointermove', onMove);
      this.el.removeEventListener('pointerup', onUp);
      this.el.removeEventListener('pointercancel', onUp);
      this.el.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers.length = 0;
  }
}
