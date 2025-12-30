import { z } from "zod/v4";

/**
 * Supported column data types for row editing
 */
export const columnDataTypes = [
	"string",
	"number",
	"integer",
	"boolean",
	"date",
	"datetime",
	"time",
	"json",
	"text",
	"uuid",
	"enum",
] as const;

export type ColumnDataType = (typeof columnDataTypes)[number];

/**
 * Column definition for row editing
 */
export interface ColumnDefinition {
	name: string;
	type: ColumnDataType;
	nullable: boolean;
	primaryKey?: boolean;
	autoIncrement?: boolean;
	defaultValue?: unknown;
	enumValues?: string[];
	maxLength?: number;
	minValue?: number;
	maxValue?: number;
}

/**
 * Row data type - a record of column name to value
 */
export type RowData = Record<string, unknown>;

/**
 * Editor mode - insert, update, or view
 */
export type EditorMode = "insert" | "update" | "view";

/**
 * Form field validation errors
 */
export type FieldErrors = Partial<Record<string, string>>;

/**
 * Submission status for async operations
 */
export type SubmissionStatus = "idle" | "submitting" | "success" | "error";

/**
 * Row editor form state
 */
export interface RowEditorFormState {
	fields: RowData;
	errors: FieldErrors;
	isDirty: boolean;
	mode: EditorMode;
	status: SubmissionStatus;
}

/**
 * Result of a row operation (insert, update, delete)
 */
export interface RowOperationResult {
	success: boolean;
	message: string;
	data?: RowData;
}

/**
 * Props for the row editor modal
 */
export interface RowEditorModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: EditorMode;
	columns: ColumnDefinition[];
	initialData?: RowData;
	tableName: string;
	onInsert?: (data: RowData) => Promise<RowOperationResult>;
	onUpdate?: (data: RowData, originalData: RowData) => Promise<RowOperationResult>;
	onDelete?: (data: RowData) => Promise<RowOperationResult>;
}

/**
 * Props for the row editor form
 */
export interface RowEditorFormProps {
	columns: ColumnDefinition[];
	fields: RowData;
	errors: FieldErrors;
	mode: EditorMode;
	disabled?: boolean;
	onFieldChange: (name: string, value: unknown) => void;
}

/**
 * Props for the type-aware field component
 */
export interface TypeAwareFieldProps {
	column: ColumnDefinition;
	value: unknown;
	error?: string;
	disabled?: boolean;
	onChange: (value: unknown) => void;
}

/**
 * Props for delete confirmation dialog
 */
export interface DeleteConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	tableName: string;
	isDeleting?: boolean;
}

/**
 * Create a Zod schema for a single column based on its type
 */
export function createColumnSchema(column: ColumnDefinition): z.ZodType<unknown> {
	let schema: z.ZodType<unknown>;

	switch (column.type) {
		case "string":
		case "text":
		case "uuid":
			schema = z.string();
			if (column.maxLength) {
				schema = (schema as z.ZodString).max(column.maxLength, `Maximum ${column.maxLength} characters`);
			}
			break;

		case "number":
			schema = z.coerce.number();
			if (column.minValue !== undefined) {
				schema = (schema as z.ZodNumber).min(column.minValue, `Minimum value is ${column.minValue}`);
			}
			if (column.maxValue !== undefined) {
				schema = (schema as z.ZodNumber).max(column.maxValue, `Maximum value is ${column.maxValue}`);
			}
			break;

		case "integer":
			schema = z.coerce.number().int("Must be a whole number");
			if (column.minValue !== undefined) {
				schema = (schema as z.ZodNumber).min(column.minValue, `Minimum value is ${column.minValue}`);
			}
			if (column.maxValue !== undefined) {
				schema = (schema as z.ZodNumber).max(column.maxValue, `Maximum value is ${column.maxValue}`);
			}
			break;

		case "boolean":
			schema = z.boolean();
			break;

		case "date":
		case "datetime":
		case "time":
			schema = z.coerce.date();
			break;

		case "json":
			schema = z.string().transform((val, ctx) => {
				try {
					return JSON.parse(val);
				} catch {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Invalid JSON format",
					});
					return z.NEVER;
				}
			});
			break;

		case "enum":
			if (column.enumValues && column.enumValues.length > 0) {
				schema = z.enum(column.enumValues as [string, ...string[]]);
			} else {
				schema = z.string();
			}
			break;

		default:
			schema = z.unknown();
	}

	// Handle nullable columns
	if (column.nullable) {
		schema = schema.nullable().optional();
	}

	return schema;
}

/**
 * Create a Zod schema for the entire row based on column definitions
 */
export function createRowSchema(columns: ColumnDefinition[]): z.ZodObject<Record<string, z.ZodType<unknown>>> {
	const shape: Record<string, z.ZodType<unknown>> = {};

	for (const column of columns) {
		shape[column.name] = createColumnSchema(column);
	}

	return z.object(shape);
}

/**
 * Format a value for display based on column type
 */
export function formatValueForDisplay(value: unknown, type: ColumnDataType): string {
	if (value === null || value === undefined) {
		return "";
	}

	switch (type) {
		case "boolean":
			return value ? "true" : "false";
		case "json":
			return typeof value === "string" ? value : JSON.stringify(value, null, 2);
		case "date":
			if (value instanceof Date) {
				return value.toISOString().split("T")[0];
			}
			return String(value);
		case "datetime":
			if (value instanceof Date) {
				return value.toISOString();
			}
			return String(value);
		case "time":
			if (value instanceof Date) {
				return value.toTimeString().split(" ")[0];
			}
			return String(value);
		default:
			return String(value);
	}
}

/**
 * Parse a value from input based on column type
 */
export function parseValueFromInput(value: string, type: ColumnDataType): unknown {
	if (value === "" || value === null || value === undefined) {
		return null;
	}

	switch (type) {
		case "number":
			return parseFloat(value);
		case "integer":
			return parseInt(value, 10);
		case "boolean":
			return value === "true";
		case "json":
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		case "date":
		case "datetime":
			return new Date(value);
		default:
			return value;
	}
}
