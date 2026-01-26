declare module 'escpos' {
  export class Printer {
    constructor(device: any, options?: any);
    font(type: string): this;
    align(align: string): this;
    style(type: string): this;
    size(width: number, height: number): this;
    text(content: string): this;
    drawLine(): this;
    cut(): this;
    close(callback?: (error?: Error) => void): this;
  }

  export class Image {
    constructor(img: any);
    static load(path: string, callback: (image: Image) => void): void;
  }

  export const command: {
    HARDWARE: {
      HW_INIT: string;
      HW_RESET: string;
    };
  };

  // Allow dynamic assignment of USB/Network
  export let USB: any;
  export let Network: any;
}

declare module 'escpos-usb' {
  class USB {
    constructor(vid?: number, pid?: number);
    open(callback?: (error?: Error) => void): this;
    close(callback?: (error?: Error) => void): this;
    static findPrinter(): any[];
  }
  
  const _default: typeof USB & { findPrinter(): any[] };
  export default _default;
  export = USB;
}

declare module 'escpos-network' {
  class Network {
    constructor(address: string, port?: number);
    open(callback?: (error?: Error) => void): this;
    close(callback?: (error?: Error) => void): this;
  }
  
  const _default: typeof Network;
  export default _default;
  export = Network;
}
