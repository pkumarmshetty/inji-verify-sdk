// declare const validate: (file: File) => Promise<Uint8Array | null>;
// export default validate;
// declare module 'simple-data-validator' {
//     /**
//      * Validates a file by scanning it for a QR code.
//      * Returns the content as a Uint8Array if valid, or null otherwise.
//      * 
//      * @param file - The file to validate (image or PDF).
//      */
//     export default function validate(file: File): Promise<Uint8Array | null>;
//   }
  
declare module 'inji-verify-sdk' {
  /**
   * Validates a file by scanning it for a QR code.
   * Returns the content as a Uint8Array if valid, or null otherwise.
   * 
   * @param file - The file to validate (image or PDF).
   */
  export function VCverification(file: File, url: string): Promise<any>;

  /**
   * Validates a file by scanning it for a QR code without a name parameter.
   * Returns the content as a Uint8Array if valid, or null otherwise.
   * 
   * @param file - The file to validate (image or PDF).
   */
  export function VCverificationScanQrcode(file: File, url: string): Promise<any>;
}
