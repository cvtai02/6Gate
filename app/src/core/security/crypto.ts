import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENC_PREFIX = "enc:";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptValue(value: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function decryptValue(value: string, secret: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value; // plaintext passthrough
  const [ivHex, tagHex, ctHex] = value.slice(ENC_PREFIX.length).split(":");
  if (!ivHex || !tagHex || !ctHex) return value;
  try {
    const key = deriveKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return value;
  }
}
