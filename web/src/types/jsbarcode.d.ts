declare module 'jsbarcode' {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    margin?: number;
    background?: string;
    lineColor?: string;
  }

  export default function JsBarcode(element: Element | string, value: string, options?: JsBarcodeOptions): void;
}
