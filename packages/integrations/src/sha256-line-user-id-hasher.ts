import { createHash } from "node:crypto";
import type { LineUserIdHasher } from "./line-webhook-repository";

export class Sha256LineUserIdHasher implements LineUserIdHasher {
  hash(lineUserId: string, pepper: string): string {
    return createHash("sha256").update(`${lineUserId}\u0000${pepper}`).digest("hex");
  }
}
