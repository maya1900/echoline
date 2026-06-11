import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const encryptedPrefix = "enc:v1";

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";

  if (!secret.trim()) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

export function canSealSecretValue() {
  return Boolean(getEncryptionKey());
}

export function isEncryptedSecretValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${encryptedPrefix}:`);
}

export function hasStoredSecretValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function sealSecretValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed || isEncryptedSecretValue(trimmed)) {
    return trimmed;
  }

  const key = getEncryptionKey();

  if (!key) {
    return "";
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [encryptedPrefix, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function openSecretValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (!isEncryptedSecretValue(trimmed)) {
    return trimmed;
  }

  const key = getEncryptionKey();

  if (!key) {
    return "";
  }

  const [, version, ivValue, tagValue, ciphertextValue] = trimmed.split(":");

  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    return "";
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));

    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
