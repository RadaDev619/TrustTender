export const PROPOSAL_SECTIONS = [
  "eligibility",
  "technical",
  "financial",
  "supporting",
] as const;

export type ProposalSectionName = (typeof PROPOSAL_SECTIONS)[number];

export type ProposalSectionProgress = "Encrypted" | "Hash generated";
export type ProposalEnvelopeAlgorithm = "AES-GCM" | "DEMO-XOR-SHA256";

export interface ProposalSectionInput {
  section: ProposalSectionName;
  fileName: string;
  mimeType: string;
  content: Blob | ArrayBuffer | string;
}

export interface ProposalSectionMetadata {
  fileName: string;
  mimeType: string;
  originalByteLength: number;
  encryptedByteLength: number;
  submittedAt: string;
}

export interface EncryptedSectionEnvelope {
  section: ProposalSectionName;
  algorithm: ProposalEnvelopeAlgorithm;
  keyRef: string;
  encryptedBlobRef: string;
  iv: string;
  encryptedHash: string;
  envelopeHash: string;
  metadata: ProposalSectionMetadata;
}

export interface ProposalEncryptionManifest {
  version: "proposal-manifest-v1";
  tenderId: string;
  proposalId: string;
  vendorIdentityHash: string;
  createdAt: string;
  sections: Record<ProposalSectionName, EncryptedSectionEnvelope>;
  sectionEnvelopeHashes: string[];
  proposalManifestHash: string;
}

export interface ProposalSectionKeyRecord {
  tenderId: string;
  proposalId: string;
  section: ProposalSectionName;
  keyRef: string;
  algorithm: ProposalEnvelopeAlgorithm;
  rawKeyBase64: string;
  createdAt: string;
  createdByIdentityHash: string;
}

export interface ProposalEncryptionResult {
  manifest: ProposalEncryptionManifest;
}

interface EncryptProposalSectionsInput {
  tenderId: string;
  proposalId: string;
  vendorIdentityHash: string;
  sections: ProposalSectionInput[];
  persistKey?: (record: ProposalSectionKeyRecord) => void | Promise<void>;
  onSectionProgress?: (
    section: ProposalSectionName,
    progress: ProposalSectionProgress,
  ) => void;
}

interface StoredEncryptedBlob {
  ref: string;
  cipherTextBase64: string;
  encryptedHash: string;
  envelopeHash: string;
  metadata: ProposalSectionMetadata;
}

const ENCRYPTED_BLOB_STORAGE_KEY = "egpTrustLayer.encryptedProposalBlobs";
const PROPOSAL_MANIFEST_STORAGE_KEY = "egpTrustLayer.proposalManifests";
export const ProposalCryptoStorageChangedEvent =
  "egpTrustLayer.proposalCryptoStorageChanged";

export async function encryptProposalSections({
  tenderId,
  proposalId,
  vendorIdentityHash,
  sections,
  persistKey,
  onSectionProgress,
}: EncryptProposalSectionsInput): Promise<ProposalEncryptionResult> {
  const webCrypto = getSecureWebCrypto();
  const createdAt = new Date().toISOString();
  const encryptedSections: Partial<
    Record<ProposalSectionName, EncryptedSectionEnvelope>
  > = {};

  for (const section of PROPOSAL_SECTIONS) {
    const sectionInput = sections.find((item) => item.section === section);
    if (!sectionInput) {
      throw new Error(`${formatSectionName(section)} section is required.`);
    }

    const plainBuffer = await contentToArrayBuffer(sectionInput.content);
    const plainBytes = new Uint8Array(plainBuffer);
    if (plainBytes.byteLength === 0) {
      throw new Error(`${formatSectionName(section)} section cannot be empty.`);
    }

    const ivBytes = new Uint8Array(12);
    fillRandomBytes(ivBytes);

    let cipherBytes: Uint8Array;
    let rawKeyBytes: Uint8Array;
    const algorithm: ProposalEnvelopeAlgorithm = webCrypto
      ? "AES-GCM"
      : "DEMO-XOR-SHA256";
    try {
      if (webCrypto) {
        const key = await webCrypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
        const cipherBuffer = await webCrypto.subtle.encrypt(
          { name: "AES-GCM", iv: ivBytes },
          key,
          plainBytes,
        );
        cipherBytes = new Uint8Array(cipherBuffer);
        rawKeyBytes = new Uint8Array(await webCrypto.subtle.exportKey("raw", key));
      } else {
        rawKeyBytes = new Uint8Array(32);
        fillRandomBytes(rawKeyBytes);
        cipherBytes = demoEncrypt(plainBytes, rawKeyBytes, ivBytes);
      }
    } finally {
      plainBytes.fill(0);
    }

    onSectionProgress?.(section, "Encrypted");

    const keyRef = createKeyRef(tenderId, proposalId, section);
    await persistKey?.({
      tenderId,
      proposalId,
      section,
      keyRef,
      algorithm,
      rawKeyBase64: bytesToBase64(rawKeyBytes),
      createdAt,
      createdByIdentityHash: vendorIdentityHash,
    });

    const encryptedHash = await sha256Hex(cipherBytes);
    const metadata: ProposalSectionMetadata = {
      fileName: sectionInput.fileName,
      mimeType: sectionInput.mimeType,
      originalByteLength: plainBuffer.byteLength,
      encryptedByteLength: cipherBytes.byteLength,
      submittedAt: createdAt,
    };
    const encryptedBlobRef = createEncryptedBlobRef(
      tenderId,
      proposalId,
      section,
    );

    const envelopeSeed = {
      section,
      algorithm,
      keyRef,
      encryptedBlobRef,
      iv: bytesToBase64(ivBytes),
      encryptedHash,
      metadata,
    };
    const envelopeHash = await sha256Hex(
      new TextEncoder().encode(canonicalJson(envelopeSeed)),
    );

    const envelope: EncryptedSectionEnvelope = {
      ...envelopeSeed,
      envelopeHash,
    };
    encryptedSections[section] = envelope;

    persistEncryptedBlob({
      ref: encryptedBlobRef,
      cipherTextBase64: bytesToBase64(cipherBytes),
      encryptedHash,
      envelopeHash,
      metadata,
    });

    onSectionProgress?.(section, "Hash generated");
  }

  const completeSections =
    encryptedSections as Record<ProposalSectionName, EncryptedSectionEnvelope>;
  const sectionEnvelopeHashes = PROPOSAL_SECTIONS.map(
    (section) => completeSections[section].envelopeHash,
  );
  const manifestSeed = {
    version: "proposal-manifest-v1" as const,
    tenderId,
    proposalId,
    vendorIdentityHash,
    createdAt,
    sectionEnvelopeHashes,
  };
  const proposalManifestHash = await sha256Hex(
    new TextEncoder().encode(canonicalJson(manifestSeed)),
  );
  const manifest: ProposalEncryptionManifest = {
    ...manifestSeed,
    sections: completeSections,
    proposalManifestHash,
  };

  persistProposalManifest(manifest);
  return { manifest };
}

export function createProposalId(tenderId: string): string {
  const randomBytes = new Uint8Array(4);
  fillRandomBytes(randomBytes);
  return `P-${tenderId.split("-").at(-1) ?? "NEW"}-${bytesToHex(randomBytes)}`;
}

export function getStoredEncryptedBlob(
  ref: string,
): StoredEncryptedBlob | null {
  return readRecordStore<StoredEncryptedBlob>(ENCRYPTED_BLOB_STORAGE_KEY)[ref] ??
    null;
}

export async function decryptProposalSection({
  envelope,
  keyRecord,
}: {
  envelope: EncryptedSectionEnvelope;
  keyRecord: ProposalSectionKeyRecord;
}): Promise<string> {
  const encryptedBlob = getStoredEncryptedBlob(envelope.encryptedBlobRef);
  if (!encryptedBlob) {
    throw new Error("Encrypted proposal content was not found in demo storage.");
  }

  if (!constantTimeEqual(encryptedBlob.envelopeHash, envelope.envelopeHash)) {
    throw new Error("Encrypted proposal envelope hash does not match.");
  }

  const cipherBytes = base64ToBytes(encryptedBlob.cipherTextBase64);
  const encryptedHash = await sha256Hex(cipherBytes);
  if (!constantTimeEqual(encryptedHash, envelope.encryptedHash)) {
    throw new Error("Encrypted proposal hash verification failed.");
  }

  const keyBytes = base64ToBytes(keyRecord.rawKeyBase64);
  const ivBytes = base64ToBytes(envelope.iv);

  if (envelope.algorithm === "DEMO-XOR-SHA256") {
    const plainBytes = demoDecrypt(cipherBytes, keyBytes, ivBytes);
    return new TextDecoder().decode(plainBytes);
  }

  const webCrypto = getSecureWebCrypto();
  if (!webCrypto) {
    throw new Error(
      "This AES-GCM proposal was created in a secure browser context. Open the app at http://localhost:3000 to decrypt it, or submit a new proposal from this browser origin.",
    );
  }

  const key = await webCrypto.subtle.importKey(
    "raw",
    copyBytesToArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plainBuffer = await webCrypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: copyBytesToArrayBuffer(ivBytes),
    },
    key,
    copyBytesToArrayBuffer(cipherBytes),
  );

  return new TextDecoder().decode(plainBuffer);
}

export function listStoredProposalManifests(
  tenderId?: string,
): ProposalEncryptionManifest[] {
  const manifests = Object.values(
    readRecordStore<ProposalEncryptionManifest>(PROPOSAL_MANIFEST_STORAGE_KEY),
  );
  return tenderId
    ? manifests.filter((manifest) => manifest.tenderId === tenderId)
    : manifests;
}

export function clearEncryptedProposalStorage(): void {
  const store = getBrowserStorage();
  store?.removeItem(ENCRYPTED_BLOB_STORAGE_KEY);
  store?.removeItem(PROPOSAL_MANIFEST_STORAGE_KEY);
  dispatchProposalCryptoStorageChanged();
}

function persistEncryptedBlob(record: StoredEncryptedBlob): void {
  const current = readRecordStore<StoredEncryptedBlob>(
    ENCRYPTED_BLOB_STORAGE_KEY,
  );
  current[record.ref] = record;
  writeRecordStore(ENCRYPTED_BLOB_STORAGE_KEY, current);
}

function persistProposalManifest(manifest: ProposalEncryptionManifest): void {
  const current = readRecordStore<ProposalEncryptionManifest>(
    PROPOSAL_MANIFEST_STORAGE_KEY,
  );
  current[manifest.proposalManifestHash] = manifest;
  writeRecordStore(PROPOSAL_MANIFEST_STORAGE_KEY, current);
  dispatchProposalCryptoStorageChanged();
}

function dispatchProposalCryptoStorageChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ProposalCryptoStorageChangedEvent));
}

function createEncryptedBlobRef(
  tenderId: string,
  proposalId: string,
  section: ProposalSectionName,
): string {
  return `demo-storage://encrypted-proposals/${tenderId}/${proposalId}/${section}`;
}

function createKeyRef(
  tenderId: string,
  proposalId: string,
  section: ProposalSectionName,
): string {
  return `kms://simulated/${tenderId}/${proposalId}/${section}`;
}

async function contentToArrayBuffer(
  content: Blob | ArrayBuffer | string,
): Promise<ArrayBuffer> {
  if (typeof content === "string") {
    return copyBytesToArrayBuffer(new TextEncoder().encode(content));
  }
  if (content instanceof ArrayBuffer) {
    return content.slice(0);
  }
  return content.arrayBuffer();
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const digestInput =
    data instanceof Uint8Array ? copyBytesToArrayBuffer(data) : data;
  const webCrypto = getSecureWebCrypto();
  if (!webCrypto) {
    return bytesToHex(sha256Bytes(new Uint8Array(digestInput)));
  }
  const digest = await webCrypto.subtle.digest("SHA-256", digestInput);
  return bytesToHex(new Uint8Array(digest));
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortObjectKeys(nested)]),
    );
  }
  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function readRecordStore<T>(storageKey: string): Record<string, T> {
  const store = getBrowserStorage();
  if (!store) return {};

  const raw = store.getItem(storageKey);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, T>)
      : {};
  } catch {
    store.removeItem(storageKey);
    return {};
  }
}

function writeRecordStore<T>(
  storageKey: string,
  value: Record<string, T>,
): void {
  const store = getBrowserStorage();
  if (!store) return;
  store.setItem(storageKey, JSON.stringify(value));
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getSecureWebCrypto(): Crypto | null {
  if (typeof window === "undefined") return null;
  if (!window.crypto?.subtle || !window.crypto.getRandomValues) return null;
  return window.crypto;
}

function fillRandomBytes(bytes: Uint8Array): void {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
    return;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
}

function demoEncrypt(
  plainBytes: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array,
): Uint8Array {
  const keyStream = demoKeyStream(keyBytes, ivBytes, plainBytes.byteLength);
  const cipherBytes = new Uint8Array(plainBytes.byteLength);
  for (let index = 0; index < plainBytes.byteLength; index += 1) {
    cipherBytes[index] = plainBytes[index] ^ keyStream[index];
  }
  const tag = sha256Bytes(concatBytes(keyBytes, ivBytes, cipherBytes)).subarray(
    0,
    16,
  );
  return concatBytes(cipherBytes, tag);
}

function demoDecrypt(
  cipherWithTag: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array,
): Uint8Array {
  if (cipherWithTag.byteLength < 16) {
    throw new Error("Encrypted proposal envelope is incomplete.");
  }

  const cipherBytes = cipherWithTag.subarray(0, cipherWithTag.byteLength - 16);
  const tag = cipherWithTag.subarray(cipherWithTag.byteLength - 16);
  const expectedTag = sha256Bytes(
    concatBytes(keyBytes, ivBytes, cipherBytes),
  ).subarray(0, 16);
  if (!constantTimeEqualBytes(tag, expectedTag)) {
    throw new Error("Encrypted proposal integrity check failed.");
  }

  const keyStream = demoKeyStream(keyBytes, ivBytes, cipherBytes.byteLength);
  const plainBytes = new Uint8Array(cipherBytes.byteLength);
  for (let index = 0; index < cipherBytes.byteLength; index += 1) {
    plainBytes[index] = cipherBytes[index] ^ keyStream[index];
  }
  return plainBytes;
}

function demoKeyStream(
  keyBytes: Uint8Array,
  ivBytes: Uint8Array,
  byteLength: number,
): Uint8Array {
  const output = new Uint8Array(byteLength);
  let offset = 0;
  let counter = 0;

  while (offset < byteLength) {
    const counterBytes = new Uint8Array([
      (counter >>> 24) & 0xff,
      (counter >>> 16) & 0xff,
      (counter >>> 8) & 0xff,
      counter & 0xff,
    ]);
    const block = sha256Bytes(concatBytes(keyBytes, ivBytes, counterBytes));
    output.set(block.subarray(0, byteLength - offset), offset);
    offset += Math.min(block.byteLength, byteLength - offset);
    counter += 1;
  }

  return output;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function constantTimeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;

  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLength = data.byteLength * 8;
  const totalLength = Math.ceil((data.byteLength + 1 + 8) / 64) * 64;
  const padded = new Uint8Array(totalLength);
  padded.set(data);
  padded[data.byteLength] = 0x80;

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded[totalLength - 8] = (high >>> 24) & 0xff;
  padded[totalLength - 7] = (high >>> 16) & 0xff;
  padded[totalLength - 6] = (high >>> 8) & 0xff;
  padded[totalLength - 5] = high & 0xff;
  padded[totalLength - 4] = (low >>> 24) & 0xff;
  padded[totalLength - 3] = (low >>> 16) & 0xff;
  padded[totalLength - 2] = (low >>> 8) & 0xff;
  padded[totalLength - 1] = low & 0xff;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const wordOffset = offset + index * 4;
      words[index] =
        (padded[wordOffset] << 24) |
        (padded[wordOffset + 1] << 16) |
        (padded[wordOffset + 2] << 8) |
        padded[wordOffset + 3];
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] =
        (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 =
        rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[index] + words[index]) >>> 0;
      const s0 =
        rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  [
    h0, h1, h2, h3, h4, h5, h6, h7,
  ].forEach((word, index) => {
    const offset = index * 4;
    digest[offset] = (word >>> 24) & 0xff;
    digest[offset + 1] = (word >>> 16) & 0xff;
    digest[offset + 2] = (word >>> 8) & 0xff;
    digest[offset + 3] = word & 0xff;
  });
  return digest;
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function formatSectionName(section: ProposalSectionName): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}
