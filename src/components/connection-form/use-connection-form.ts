import * as React from "react";
import { z } from "zod/v4";
import { parseConnectionString, buildConnectionString } from "~/lib/connection-string";
import {
	type ConnectionFormFields,
	type InputMode,
	type FieldErrors,
	type TestStatus,
	type ConnectionTestResult,
	connectionFormFieldsSchema,
	defaultFormValues,
	defaultPorts,
	type ProviderType,
} from "./types";

interface UseConnectionFormOptions {
	initialValues?: Partial<ConnectionFormFields>;
	initialMode?: InputMode;
	onTest?: (fields: ConnectionFormFields) => Promise<ConnectionTestResult>;
}

interface UseConnectionFormReturn {
	// Form state
	fields: ConnectionFormFields;
	connectionString: string;
	mode: InputMode;
	errors: FieldErrors;
	isDirty: boolean;

	// Test state
	testStatus: TestStatus;
	testResult: ConnectionTestResult | null;

	// Field handlers
	setField: <K extends keyof ConnectionFormFields>(key: K, value: ConnectionFormFields[K]) => void;
	setConnectionString: (value: string) => void;
	setMode: (mode: InputMode) => void;

	// Actions
	validate: () => boolean;
	syncFromConnectionString: () => void;
	syncToConnectionString: () => void;
	testConnection: () => Promise<void>;
	reset: () => void;
	getFormData: () => ConnectionFormFields;
}

export function useConnectionForm(options: UseConnectionFormOptions = {}): UseConnectionFormReturn {
	const { initialValues, initialMode = "fields", onTest } = options;

	// Merge initial values with defaults
	const initialFields = React.useMemo(
		() => ({
			...defaultFormValues,
			...initialValues,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	// Form state
	const [fields, setFields] = React.useState<ConnectionFormFields>(initialFields);
	const [connectionString, setConnectionStringState] = React.useState("");
	const [mode, setModeState] = React.useState<InputMode>(initialMode);
	const [errors, setErrors] = React.useState<FieldErrors>({});
	const [isDirty, setIsDirty] = React.useState(false);

	// Test state
	const [testStatus, setTestStatus] = React.useState<TestStatus>("idle");
	const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);

	// Set a single field value
	const setField = React.useCallback(<K extends keyof ConnectionFormFields>(key: K, value: ConnectionFormFields[K]) => {
		setFields((prev) => {
			const next = { ...prev, [key]: value };

			// Auto-update port when provider type changes
			if (key === "providerType" && typeof value === "string") {
				const providerType = value as ProviderType;
				if (prev.port === defaultPorts[prev.providerType]) {
					next.port = defaultPorts[providerType];
				}
			}

			return next;
		});
		setIsDirty(true);
		// Clear field-specific error when value changes
		setErrors((prev) => {
			if (prev[key]) {
				const next = { ...prev };
				delete next[key];
				return next;
			}
			return prev;
		});
		// Reset test status when fields change
		setTestStatus("idle");
		setTestResult(null);
	}, []);

	// Set connection string
	const setConnectionString = React.useCallback((value: string) => {
		setConnectionStringState(value);
		setIsDirty(true);
		setErrors((prev) => {
			if (prev.connectionString) {
				const next = { ...prev };
				delete next.connectionString;
				return next;
			}
			return prev;
		});
		// Reset test status when connection string changes
		setTestStatus("idle");
		setTestResult(null);
	}, []);

	// Set input mode
	const setMode = React.useCallback((newMode: InputMode) => {
		setModeState(newMode);
		setErrors({});
	}, []);

	// Sync fields from connection string
	const syncFromConnectionString = React.useCallback(() => {
		const result = parseConnectionString(connectionString);

		if (!result.success) {
			setErrors({ connectionString: result.error.message });
			return;
		}

		const { data } = result;

		setFields((prev) => ({
			...prev,
			providerType: data.providerType,
			host: data.host,
			port: data.port,
			database: data.database,
			username: data.username,
			password: data.password,
			sslConfig: {
				...prev.sslConfig,
				enabled: data.sslEnabled,
			},
		}));

		setErrors({});
	}, [connectionString]);

	// Sync connection string from fields
	const syncToConnectionString = React.useCallback(() => {
		const newConnectionString = buildConnectionString({
			providerType: fields.providerType,
			host: fields.host,
			port: fields.port,
			database: fields.database,
			username: fields.username,
			password: fields.password,
			sslEnabled: fields.sslConfig.enabled,
		});

		setConnectionStringState(newConnectionString);
	}, [fields]);

	// Validate form based on current mode
	const validate = React.useCallback((): boolean => {
		if (mode === "connectionString") {
			// First parse the connection string
			const result = parseConnectionString(connectionString);

			if (!result.success) {
				setErrors({ connectionString: result.error.message });
				return false;
			}

			// Create a complete fields object for validation
			const fieldsFromString: ConnectionFormFields = {
				...fields,
				providerType: result.data.providerType,
				host: result.data.host,
				port: result.data.port,
				database: result.data.database,
				username: result.data.username,
				password: result.data.password,
				sslConfig: {
					...fields.sslConfig,
					enabled: result.data.sslEnabled,
				},
			};

			// Validate using schema
			try {
				connectionFormFieldsSchema.parse(fieldsFromString);
				setErrors({});
				return true;
			} catch (error) {
				if (error instanceof z.ZodError) {
					const newErrors: FieldErrors = {};
					for (const issue of error.issues) {
						const path = issue.path[0];
						if (typeof path === "string") {
							newErrors[path as keyof ConnectionFormFields] = issue.message;
						}
					}
					setErrors(newErrors);
				}
				return false;
			}
		} else {
			// Validate fields directly
			try {
				connectionFormFieldsSchema.parse(fields);
				setErrors({});
				return true;
			} catch (error) {
				if (error instanceof z.ZodError) {
					const newErrors: FieldErrors = {};
					for (const issue of error.issues) {
						const path = issue.path[0];
						if (typeof path === "string") {
							newErrors[path as keyof ConnectionFormFields] = issue.message;
						}
					}
					setErrors(newErrors);
				}
				return false;
			}
		}
	}, [mode, connectionString, fields]);

	// Test connection
	const testConnection = React.useCallback(async () => {
		if (!onTest) return;

		// Validate first
		if (!validate()) {
			return;
		}

		// Get the current field values (sync from connection string if needed)
		let testFields = fields;
		if (mode === "connectionString") {
			const result = parseConnectionString(connectionString);
			if (result.success) {
				testFields = {
					...fields,
					providerType: result.data.providerType,
					host: result.data.host,
					port: result.data.port,
					database: result.data.database,
					username: result.data.username,
					password: result.data.password,
					sslConfig: {
						...fields.sslConfig,
						enabled: result.data.sslEnabled,
					},
				};
			}
		}

		setTestStatus("testing");
		setTestResult(null);

		try {
			const result = await onTest(testFields);
			setTestResult(result);
			setTestStatus(result.success ? "success" : "error");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Connection test failed";
			setTestResult({
				success: false,
				message,
				latencyMs: 0,
			});
			setTestStatus("error");
		}
	}, [onTest, validate, mode, connectionString, fields]);

	// Reset form to initial state
	const reset = React.useCallback(() => {
		setFields(initialFields);
		setConnectionStringState("");
		setErrors({});
		setIsDirty(false);
		setTestStatus("idle");
		setTestResult(null);
	}, [initialFields]);

	// Get current form data (merging connection string data if in that mode)
	const getFormData = React.useCallback((): ConnectionFormFields => {
		if (mode === "connectionString") {
			const result = parseConnectionString(connectionString);
			if (result.success) {
				return {
					...fields,
					providerType: result.data.providerType,
					host: result.data.host,
					port: result.data.port,
					database: result.data.database,
					username: result.data.username,
					password: result.data.password,
					sslConfig: {
						...fields.sslConfig,
						enabled: result.data.sslEnabled,
					},
				};
			}
		}
		return fields;
	}, [mode, connectionString, fields]);

	return {
		fields,
		connectionString,
		mode,
		errors,
		isDirty,
		testStatus,
		testResult,
		setField,
		setConnectionString,
		setMode,
		validate,
		syncFromConnectionString,
		syncToConnectionString,
		testConnection,
		reset,
		getFormData,
	};
}
