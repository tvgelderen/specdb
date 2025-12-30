import * as React from "react";
import { z } from "zod/v4";
import {
	type ColumnDefinition,
	type EditorMode,
	type FieldErrors,
	type RowData,
	type RowOperationResult,
	type SubmissionStatus,
	createRowSchema,
} from "./types";

interface UseRowFormOptions {
	columns: ColumnDefinition[];
	mode: EditorMode;
	initialData?: RowData;
	onInsert?: (data: RowData) => Promise<RowOperationResult>;
	onUpdate?: (data: RowData, originalData: RowData) => Promise<RowOperationResult>;
	onDelete?: (data: RowData) => Promise<RowOperationResult>;
}

interface UseRowFormReturn {
	// Form state
	fields: RowData;
	errors: FieldErrors;
	isDirty: boolean;
	status: SubmissionStatus;
	result: RowOperationResult | null;

	// Field handlers
	setField: (name: string, value: unknown) => void;
	setFields: (fields: RowData) => void;

	// Actions
	validate: () => boolean;
	submit: () => Promise<boolean>;
	deleteRow: () => Promise<boolean>;
	reset: () => void;
	getFormData: () => RowData;
}

/**
 * Creates default values for a row based on column definitions
 */
function createDefaultValues(columns: ColumnDefinition[]): RowData {
	const values: RowData = {};

	for (const column of columns) {
		if (column.defaultValue !== undefined) {
			values[column.name] = column.defaultValue;
		} else if (column.nullable) {
			values[column.name] = null;
		} else {
			// Set type-appropriate defaults
			switch (column.type) {
				case "string":
				case "text":
				case "uuid":
					values[column.name] = "";
					break;
				case "number":
				case "integer":
					values[column.name] = 0;
					break;
				case "boolean":
					values[column.name] = false;
					break;
				case "json":
					values[column.name] = "{}";
					break;
				case "date":
				case "datetime":
				case "time":
					values[column.name] = null;
					break;
				case "enum":
					values[column.name] = column.enumValues?.[0] ?? "";
					break;
				default:
					values[column.name] = null;
			}
		}
	}

	return values;
}

export function useRowForm(options: UseRowFormOptions): UseRowFormReturn {
	const { columns, mode, initialData, onInsert, onUpdate, onDelete } = options;

	// Create initial values based on mode and provided data
	const initialFields = React.useMemo(() => {
		if (mode === "insert") {
			return createDefaultValues(columns);
		}
		return initialData ?? createDefaultValues(columns);
	}, [columns, mode, initialData]);

	// Form state
	const [fields, setFieldsState] = React.useState<RowData>(initialFields);
	const [errors, setErrors] = React.useState<FieldErrors>({});
	const [isDirty, setIsDirty] = React.useState(false);
	const [status, setStatus] = React.useState<SubmissionStatus>("idle");
	const [result, setResult] = React.useState<RowOperationResult | null>(null);

	// Create schema for validation
	const schema = React.useMemo(() => createRowSchema(columns), [columns]);

	// Reset fields when initialData changes
	React.useEffect(() => {
		if (mode === "insert") {
			setFieldsState(createDefaultValues(columns));
		} else if (initialData) {
			setFieldsState(initialData);
		}
		setErrors({});
		setIsDirty(false);
		setStatus("idle");
		setResult(null);
	}, [columns, mode, initialData]);

	// Set a single field value
	const setField = React.useCallback((name: string, value: unknown) => {
		setFieldsState((prev) => ({ ...prev, [name]: value }));
		setIsDirty(true);
		// Clear field-specific error when value changes
		setErrors((prev) => {
			if (prev[name]) {
				const next = { ...prev };
				delete next[name];
				return next;
			}
			return prev;
		});
		// Reset status when fields change
		setStatus("idle");
		setResult(null);
	}, []);

	// Set multiple fields at once
	const setFields = React.useCallback((newFields: RowData) => {
		setFieldsState(newFields);
		setIsDirty(true);
		setErrors({});
		setStatus("idle");
		setResult(null);
	}, []);

	// Validate form
	const validate = React.useCallback((): boolean => {
		try {
			schema.parse(fields);
			setErrors({});
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const newErrors: FieldErrors = {};
				for (const issue of error.issues) {
					const path = issue.path[0];
					if (typeof path === "string") {
						newErrors[path] = issue.message;
					}
				}
				setErrors(newErrors);
			}
			return false;
		}
	}, [schema, fields]);

	// Submit form (insert or update)
	const submit = React.useCallback(async (): Promise<boolean> => {
		// Validate first
		if (!validate()) {
			return false;
		}

		setStatus("submitting");
		setResult(null);

		try {
			let operationResult: RowOperationResult | undefined;

			if (mode === "insert" && onInsert) {
				operationResult = await onInsert(fields);
			} else if (mode === "update" && onUpdate && initialData) {
				operationResult = await onUpdate(fields, initialData);
			}

			if (operationResult) {
				setResult(operationResult);
				setStatus(operationResult.success ? "success" : "error");
				if (operationResult.success) {
					setIsDirty(false);
				}
				return operationResult.success;
			}

			return false;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Operation failed";
			setResult({ success: false, message });
			setStatus("error");
			return false;
		}
	}, [validate, mode, onInsert, onUpdate, fields, initialData]);

	// Delete row
	const deleteRow = React.useCallback(async (): Promise<boolean> => {
		if (!onDelete || !initialData) {
			return false;
		}

		setStatus("submitting");
		setResult(null);

		try {
			const operationResult = await onDelete(initialData);
			setResult(operationResult);
			setStatus(operationResult.success ? "success" : "error");
			return operationResult.success;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Delete operation failed";
			setResult({ success: false, message });
			setStatus("error");
			return false;
		}
	}, [onDelete, initialData]);

	// Reset form to initial state
	const reset = React.useCallback(() => {
		setFieldsState(initialFields);
		setErrors({});
		setIsDirty(false);
		setStatus("idle");
		setResult(null);
	}, [initialFields]);

	// Get current form data
	const getFormData = React.useCallback((): RowData => {
		return { ...fields };
	}, [fields]);

	return {
		fields,
		errors,
		isDirty,
		status,
		result,
		setField,
		setFields,
		validate,
		submit,
		deleteRow,
		reset,
		getFormData,
	};
}
