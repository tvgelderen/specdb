import { describe, it, expect } from "bun:test";
import {
	createSuccessEnvelope,
	createErrorEnvelope,
	createMeta,
	isSuccess,
	isError,
	getFirstError,
	unwrap,
	ErrorCodes,
	createProviderError,
} from "../envelope";

describe("Envelope Utilities", () => {
	const PROVIDER = "postgres";
	const VERSION = "1.0.0";

	describe("createMeta", () => {
		it("should create metadata with timestamp", () => {
			const meta = createMeta(PROVIDER, VERSION);
			expect(meta.provider).toBe(PROVIDER);
			expect(meta.version).toBe(VERSION);
			expect(meta.timestamp).toBeDefined();
			expect(typeof meta.timestamp).toBe("number");
		});

		it("should include duration when provided", () => {
			const meta = createMeta(PROVIDER, VERSION, 100);
			expect(meta.duration).toBe(100);
		});
	});

	describe("createSuccessEnvelope", () => {
		it("should create envelope with data", () => {
			const data = { id: 1, name: "test" };
			const envelope = createSuccessEnvelope(data, PROVIDER, VERSION);

			expect(envelope.data).toEqual(data);
			expect(envelope.errors).toEqual([]);
			expect(envelope.meta.provider).toBe(PROVIDER);
		});

		it("should create envelope with array data", () => {
			const data = [
				{ id: 1 },
				{ id: 2 },
			];
			const envelope = createSuccessEnvelope(data, PROVIDER, VERSION);

			expect(envelope.data).toEqual(data);
			expect(envelope.errors).toHaveLength(0);
		});
	});

	describe("createErrorEnvelope", () => {
		it("should create envelope from Error", () => {
			const error = new Error("Test error");
			const envelope = createErrorEnvelope(error, PROVIDER, VERSION);

			expect(envelope.data).toBeNull();
			expect(envelope.errors).toHaveLength(1);
			expect(envelope.errors[0].code).toBe("PROVIDER_ERROR");
			expect(envelope.errors[0].message).toBe("Test error");
		});

		it("should create envelope from ResponseError", () => {
			const error = {
				code: "CUSTOM_ERROR",
				message: "Custom error message",
				details: { field: "value" },
			};
			const envelope = createErrorEnvelope(error, PROVIDER, VERSION);

			expect(envelope.data).toBeNull();
			expect(envelope.errors).toHaveLength(1);
			expect(envelope.errors[0].code).toBe("CUSTOM_ERROR");
			expect(envelope.errors[0].message).toBe("Custom error message");
			expect(envelope.errors[0].details).toEqual({ field: "value" });
		});
	});

	describe("isSuccess", () => {
		it("should return true for success envelope", () => {
			const envelope = createSuccessEnvelope({ id: 1 }, PROVIDER, VERSION);
			expect(isSuccess(envelope)).toBe(true);
		});

		it("should return false for error envelope", () => {
			const envelope = createErrorEnvelope(new Error("test"), PROVIDER, VERSION);
			expect(isSuccess(envelope)).toBe(false);
		});
	});

	describe("isError", () => {
		it("should return false for success envelope", () => {
			const envelope = createSuccessEnvelope({ id: 1 }, PROVIDER, VERSION);
			expect(isError(envelope)).toBe(false);
		});

		it("should return true for error envelope", () => {
			const envelope = createErrorEnvelope(new Error("test"), PROVIDER, VERSION);
			expect(isError(envelope)).toBe(true);
		});
	});

	describe("getFirstError", () => {
		it("should return undefined for success envelope", () => {
			const envelope = createSuccessEnvelope({ id: 1 }, PROVIDER, VERSION);
			expect(getFirstError(envelope)).toBeUndefined();
		});

		it("should return first error for error envelope", () => {
			const envelope = createErrorEnvelope(new Error("First error"), PROVIDER, VERSION);
			expect(getFirstError(envelope)?.message).toBe("First error");
		});
	});

	describe("unwrap", () => {
		it("should return data for success envelope", () => {
			const data = { id: 1, name: "test" };
			const envelope = createSuccessEnvelope(data, PROVIDER, VERSION);
			expect(unwrap(envelope)).toEqual(data);
		});

		it("should throw for error envelope", () => {
			const envelope = createErrorEnvelope(new Error("Test error"), PROVIDER, VERSION);
			expect(() => unwrap(envelope)).toThrow("Test error");
		});
	});

	describe("ErrorCodes", () => {
		it("should have connection error codes", () => {
			expect(ErrorCodes.CONNECTION_FAILED).toBe("CONNECTION_FAILED");
			expect(ErrorCodes.AUTHENTICATION_FAILED).toBe("AUTHENTICATION_FAILED");
		});

		it("should have query error codes", () => {
			expect(ErrorCodes.QUERY_FAILED).toBe("QUERY_FAILED");
			expect(ErrorCodes.SYNTAX_ERROR).toBe("SYNTAX_ERROR");
		});

		it("should have data error codes", () => {
			expect(ErrorCodes.CONSTRAINT_VIOLATION).toBe("CONSTRAINT_VIOLATION");
			expect(ErrorCodes.DUPLICATE_KEY).toBe("DUPLICATE_KEY");
		});
	});

	describe("createProviderError", () => {
		it("should create a typed error", () => {
			const error = createProviderError(
				ErrorCodes.CONNECTION_FAILED,
				"Failed to connect",
				{ host: "localhost", port: 5432 }
			);

			expect(error.code).toBe("CONNECTION_FAILED");
			expect(error.message).toBe("Failed to connect");
			expect(error.details).toEqual({ host: "localhost", port: 5432 });
		});
	});
});
