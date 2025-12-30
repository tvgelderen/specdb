import * as React from "react";
import { cn } from "~/lib/utils";
import { TypeAwareField } from "./type-aware-field";
import { type RowEditorFormProps } from "./types";

/**
 * Row editor form component that renders all column fields
 */
export function RowEditorForm({
	columns,
	fields,
	errors,
	mode,
	disabled,
	onFieldChange,
	className,
}: RowEditorFormProps & { className?: string }) {
	// Sort columns to show primary keys first, then required fields, then optional
	const sortedColumns = React.useMemo(() => {
		return [...columns].sort((a, b) => {
			// Primary keys first
			if (a.primaryKey && !b.primaryKey) return -1;
			if (!a.primaryKey && b.primaryKey) return 1;

			// Then required fields (not nullable)
			if (!a.nullable && b.nullable) return -1;
			if (a.nullable && !b.nullable) return 1;

			// Then alphabetically
			return a.name.localeCompare(b.name);
		});
	}, [columns]);

	// Separate auto-increment primary keys from editable fields
	const { autoIncrementFields, editableFields } = React.useMemo(() => {
		const autoIncrement: typeof columns = [];
		const editable: typeof columns = [];

		for (const column of sortedColumns) {
			if (column.primaryKey && column.autoIncrement && mode === "insert") {
				autoIncrement.push(column);
			} else {
				editable.push(column);
			}
		}

		return { autoIncrementFields: autoIncrement, editableFields: editable };
	}, [sortedColumns, mode]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Auto-increment fields info (only in insert mode) */}
			{autoIncrementFields.length > 0 && (
				<div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
					<p>
						The following fields will be auto-generated:{" "}
						<span className="font-medium text-foreground">
							{autoIncrementFields.map((c) => c.name).join(", ")}
						</span>
					</p>
				</div>
			)}

			{/* Editable fields */}
			<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
				{editableFields.map((column) => {
					// For text, json, and long text fields - span full width
					const spanFull = column.type === "text" || column.type === "json";

					return (
						<div key={column.name} className={cn(spanFull && "md:col-span-2")}>
							<TypeAwareField
								column={column}
								value={fields[column.name]}
								error={errors[column.name]}
								disabled={disabled || mode === "view"}
								onChange={(value) => onFieldChange(column.name, value)}
							/>
						</div>
					);
				})}
			</div>

			{/* View mode info for update mode showing primary key */}
			{mode === "update" && (
				<div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
					<p>
						<span className="font-medium">Note:</span> Primary key fields cannot be modified. To change a
						primary key, delete this row and create a new one.
					</p>
				</div>
			)}
		</div>
	);
}
