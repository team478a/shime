export type PrivateObjectUpload = Readonly<{
  objectKey: string;
  bytes: Uint8Array;
  contentType: string;
}>;

export interface PrivateObjectStorageProvider {
  uploadImmutable(input: PrivateObjectUpload): Promise<void>;
  createSignedReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}
