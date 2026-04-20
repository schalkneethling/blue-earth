interface CanvasPaintEvent extends Event {
  changedElements: Element[];
}

interface HTMLCanvasElement {
  onpaint: ((event: CanvasPaintEvent) => void) | null;
  requestPaint?: () => void;
}

interface WebGLRenderingContext {
  texElementImage2D: (
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    element: Element,
  ) => void;
}
