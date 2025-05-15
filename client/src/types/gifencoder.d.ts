declare module 'gifencoder' {
  import { Readable } from 'stream';

  class GIFEncoder {
    constructor(width: number, height: number);
    
    createReadStream(): Readable;
    createWriteStream(options?: any): any;
    
    start(): void;
    setRepeat(repeat: number): void;
    setDelay(delay: number): void;
    setQuality(quality: number): void;
    setTransparent(color: number | string): void;
    setDispose(dispose: number): void;
    setFrameRate(frameRate: number): void;
    
    addFrame(ctx: any): void;
    finish(): void;
    getGif(): Buffer;
  }

  export default GIFEncoder;
}