declare module 'base45-web' {
    export function encode(buffer: ArrayBuffer): string;
    export function decode(str: string): ArrayBuffer;
}
