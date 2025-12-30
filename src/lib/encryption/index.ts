import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ENCRYPTION_KEY } from "~/lib/environment/private";
import logger from "~/lib/logging";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

const KEY_FILE_NAME = ".encryption_key";

/**
 * Gets the path to the encryption key file
 */
function getKeyFilePath(): string {
	return path.join(process.cwd(), "data", KEY_FILE_NAME);
}

/**
 * Generates a cryptographically secure random key
 */
function generateKey(): Buffer {
	return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Saves the encryption key to a file
 */
function saveKeyToFile(key: Buffer): void {
	const keyPath = getKeyFilePath();
	const keyDir = path.dirname(keyPath);

	// Ensure the data directory exists
	if (!fs.existsSync(keyDir)) {
		fs.mkdirSync(keyDir, { recursive: true });
	}

	// Write key as hex string
	fs.writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });
	logger.info("[Encryption] Generated and saved new encryption key");
}

/**
 * Loads the encryption key from file
 */
function loadKeyFromFile(): Buffer | null {
	const keyPath = getKeyFilePath();

	if (!fs.existsSync(keyPath)) {
		return null;
	}

	try {
		const keyHex = fs.readFileSync(keyPath, "utf-8").trim();
		const key = Buffer.from(keyHex, "hex");

		if (key.length !== KEY_LENGTH) {
			logger.error("[Encryption] Invalid key length in key file");
			return null;
		}

		return key;
	} catch (error) {
		logger.error("[Encryption] Failed to load key from file", { error });
		return null;
	}
}

/**
 * Gets or creates the encryption key
 * Priority: Environment variable > Key file > Generate new
 */
function getOrCreateKey(): Buffer {
	// 1. Check environment variable first
	if (ENCRYPTION_KEY) {
		const key = Buffer.from(ENCRYPTION_KEY, "hex");
		if (key.length === KEY_LENGTH) {
			logger.debug("[Encryption] Using encryption key from environment variable");
			return key;
		}
		logger.warn("[Encryption] Invalid ENCRYPTION_KEY length, ignoring environment variable");
	}

	// 2. Try to load from file
	const fileKey = loadKeyFromFile();
	if (fileKey) {
		logger.debug("[Encryption] Using encryption key from file");
		return fileKey;
	}

	// 3. Generate new key and save it
	logger.info("[Encryption] No encryption key found, generating new one");
	const newKey = generateKey();
	saveKeyToFile(newKey);
	return newKey;
}

// Cached key instance
let cachedKey: Buffer | null = null;

/**
 * Gets the encryption key (cached)
 */
function getKey(): Buffer {
	if (!cachedKey) {
		cachedKey = getOrCreateKey();
	}
	return cachedKey;
}

/**
 * Encrypts plaintext using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @returns Encrypted data as a base64 string (IV + AuthTag + Ciphertext)
 */
export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = crypto.randomBytes(IV_LENGTH);

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

	const authTag = cipher.getAuthTag();

	// Combine IV + AuthTag + Ciphertext
	const combined = Buffer.concat([iv, authTag, encrypted]);

	return combined.toString("base64");
}

/**
 * Decrypts ciphertext encrypted with AES-256-GCM
 * @param ciphertext - The encrypted base64 string (IV + AuthTag + Ciphertext)
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decrypt(ciphertext: string): string {
	const key = getKey();
	const combined = Buffer.from(ciphertext, "base64");

	// Extract IV, AuthTag, and encrypted data
	const iv = combined.subarray(0, IV_LENGTH);
	const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

	return decrypted.toString("utf8");
}

/**
 * Encrypts data and returns the result along with metadata for storage
 * Useful for database storage where you might want to store encryption version/algorithm info
 */
export function encryptForStorage(plaintext: string): {
	encrypted: string;
	algorithm: string;
	version: number;
} {
	return {
		encrypted: encrypt(plaintext),
		algorithm: ALGORITHM,
		version: 1,
	};
}

/**
 * Decrypts data from storage format
 */
export function decryptFromStorage(data: { encrypted: string; algorithm: string; version: number }): string {
	if (data.algorithm !== ALGORITHM) {
		throw new Error(`Unsupported encryption algorithm: ${data.algorithm}`);
	}
	if (data.version !== 1) {
		throw new Error(`Unsupported encryption version: ${data.version}`);
	}
	return decrypt(data.encrypted);
}

/**
 * Generates a new encryption key and returns it as a hex string
 * Useful for generating keys to set as environment variables
 */
export function generateEncryptionKey(): string {
	return generateKey().toString("hex");
}

/**
 * Validates that an encryption key is properly formatted
 */
export function isValidEncryptionKey(key: string): boolean {
	try {
		const buffer = Buffer.from(key, "hex");
		return buffer.length === KEY_LENGTH;
	} catch {
		return false;
	}
}

/**
 * Clears the cached key (useful for testing)
 */
export function clearKeyCache(): void {
	cachedKey = null;
}

/**
 * Initializes the encryption system
 * Call this on server startup to ensure the key is ready
 */
export function initializeEncryption(): void {
	getKey();
	logger.info("[Encryption] Encryption system initialized");
}
