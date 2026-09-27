declare module 'multer' {
  export function diskStorage(options: {
    destination: (request: unknown, file: unknown, callback: (error: Error | null, destination: string) => void) => void;
    filename: (request: unknown, file: unknown, callback: (error: Error | null, filename: string) => void) => void;
  }): unknown;
}
