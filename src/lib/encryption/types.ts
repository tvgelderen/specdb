/**
 * Encrypted data structure for database storage
 */
export interface EncryptedData {
	/** Base64 encoded encrypted data (IV + AuthTag + Ciphertext) */
	encrypted: string;
	/** Encryption algorithm used */
	algorithm: string;
	/** Version of the encryption format */
	version: number;
}

/**
 * Options for encryption operations
 */
export interface EncryptionOptions {
	/** Whether to include metadata with the encrypted data */
	includeMetadata?: boolean;
}
