declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
    transparent?: string | number;
    background?: string;
    dither?: boolean | string;
    debug?: boolean;
  }

  interface GIFFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  interface GIF {
    new(options: GIFOptions): GIF;
    addFrame(image: CanvasImageSource | ImageData, options?: GIFFrameOptions): void;
    render(): void;
    abort(): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'abort', callback: () => void): void;
  }

  const GIF: GIF;
  export default GIF;
}