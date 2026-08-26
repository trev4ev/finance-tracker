function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function rawKeyBytes(): Promise<Uint8Array> {
  const raw =
    Deno.env.get("PLAID_TOKEN_ENCRYPTION_KEY") || Deno.env.get("PLAID_SECRET");
  if (!raw) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY or PLAID_SECRET is required");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return hexToBytes(raw);
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
  );
}

async function getKey(
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const bytes = await rawKeyBytes();
  const copy = new Uint8Array(bytes);
  return crypto.subtle.importKey("raw", copy, "AES-GCM", false, usage);
}

/** AES-256-GCM. Format: iv.tag.ciphertext (all base64). Matches the previous Node helper. */
export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey(["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  const ciphertext = packed.slice(0, packed.length - 16);
  const tag = packed.slice(packed.length - 16);
  return `${bytesToBase64(iv)}.${bytesToBase64(tag)}.${bytesToBase64(ciphertext)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(dataB64);
  const tag = base64ToBytes(tagB64);
  const packed = new Uint8Array(data.length + tag.length);
  packed.set(data);
  packed.set(tag, data.length);
  const key = await getKey(["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    packed,
  );
  return new TextDecoder().decode(plain);
}
