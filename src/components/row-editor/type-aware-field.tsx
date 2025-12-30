import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { type TypeAwareFieldProps, formatValueForDisplay, parseValueFromInput } from "./types";

/**
 * Type-aware field component that renders the appropriate input based on column type
 */
export function TypeAwareField({ column, value, error, disabled, onChange }: TypeAwareFieldProps) {
	const { name, type, nullable, primaryKey, autoIncrement, enumValues } = column;

	// Determine if this field should be read-only
	const isReadOnly = disabled || (primaryKey && autoIncrement);

	// Common field wrapper with label and error
	const renderFieldWrapper = (children: React.ReactNode) => (
		<div className="space-y-2">
			<Label htmlFor={name} className={cn(error && "text-destructive")}>
				{name}
				{primaryKey && <span className="ml-1 text-xs text-muted-foreground">(Primary Key)</span>}
				{!nullable && !autoIncrement && <span className="ml-1 text-destructive">*</span>}
			</Label>
			{children}
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);

	// Handle null checkbox for nullable fields
	const handleNullChange = (checked: boolean) => {
		if (checked) {
			onChange(null);
		} else {
			// Set default value when un-nulling
			switch (type) {
				case "string":
				case "text":
				case "uuid":
					onChange("");
					break;
				case "number":
				case "integer":
					onChange(0);
					break;
				case "boolean":
					onChange(false);
					break;
				case "json":
					onChange("{}");
					break;
				default:
					onChange("");
			}
		}
	};

	const isNull = value === null || value === undefined;

	// Render nullable toggle for nullable fields
	const renderNullToggle = () => {
		if (!nullable || isReadOnly) return null;

		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Checkbox
					id={`${name}-null`}
					checked={isNull}
					onCheckedChange={handleNullChange}
					disabled={isReadOnly}
				/>
				<label htmlFor={`${name}-null`} className="cursor-pointer select-none">
					NULL
				</label>
			</div>
		);
	};

	// String and Text fields
	if (type === "string" || type === "uuid") {
		return renderFieldWrapper(
			<div className="space-y-2">
				<Input
					id={name}
					type="text"
					value={isNull ? "" : String(value ?? "")}
					onChange={(e) => onChange(e.target.value || (nullable ? null : ""))}
					disabled={isReadOnly || isNull}
					aria-invalid={!!error}
					maxLength={column.maxLength}
					placeholder={isNull ? "NULL" : undefined}
				/>
				{renderNullToggle()}
			</div>,
		);
	}

	// Text area for long text and JSON
	if (type === "text") {
		return renderFieldWrapper(
			<div className="space-y-2">
				<Textarea
					id={name}
					value={isNull ? "" : String(value ?? "")}
					onChange={(e) => onChange(e.target.value || (nullable ? null : ""))}
					disabled={isReadOnly || isNull}
					aria-invalid={!!error}
					maxLength={column.maxLength}
					placeholder={isNull ? "NULL" : undefined}
					rows={3}
				/>
				{renderNullToggle()}
			</div>,
		);
	}

	// JSON field with textarea and validation
	if (type === "json") {
		const displayValue = isNull ? "" : formatValueForDisplay(value, "json");

		return renderFieldWrapper(
			<div className="space-y-2">
				<Textarea
					id={name}
					value={displayValue}
					onChange={(e) => {
						const val = e.target.value;
						if (val === "" && nullable) {
							onChange(null);
						} else {
							onChange(val);
						}
					}}
					disabled={isReadOnly || isNull}
					aria-invalid={!!error}
					placeholder={isNull ? "NULL" : "{}"}
					rows={4}
					className="font-mono text-sm"
				/>
				{renderNullToggle()}
			</div>,
		);
	}

	// Number and Integer fields
	if (type === "number" || type === "integer") {
		return renderFieldWrapper(
			<div className="space-y-2">
				<Input
					id={name}
					type="number"
					value={isNull ? "" : String(value ?? "")}
					onChange={(e) => {
						const val = e.target.value;
						if (val === "" && nullable) {
							onChange(null);
						} else {
							onChange(parseValueFromInput(val, type));
						}
					}}
					disabled={isReadOnly || isNull}
					aria-invalid={!!error}
					min={column.minValue}
					max={column.maxValue}
					step={type === "integer" ? 1 : "any"}
					placeholder={isNull ? "NULL" : undefined}
				/>
				{renderNullToggle()}
			</div>,
		);
	}

	// Boolean field with switch
	if (type === "boolean") {
		return renderFieldWrapper(
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Switch
						id={name}
						checked={isNull ? false : Boolean(value)}
						onCheckedChange={(checked) => onChange(checked)}
						disabled={isReadOnly || isNull}
					/>
					<span className="text-sm text-muted-foreground">{isNull ? "NULL" : value ? "True" : "False"}</span>
				</div>
				{renderNullToggle()}
			</div>,
		);
	}

	// Date field with date picker
	if (type === "date") {
		const dateValue = isNull ? undefined : value instanceof Date ? value : value ? new Date(String(value)) : undefined;

		return renderFieldWrapper(
			<div className="space-y-2">
				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							className={cn("w-full justify-start text-left font-normal", !dateValue && "text-muted-foreground")}
							disabled={isReadOnly || isNull}
							aria-invalid={!!error}
						>
							<CalendarIcon className="mr-2 size-4" />
							{dateValue ? format(dateValue, "PPP") : isNull ? "NULL" : "Pick a date"}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="single"
							selected={dateValue}
							onSelect={(date) => onChange(date ?? (nullable ? null : undefined))}
							initialFocus
						/>
					</PopoverContent>
				</Popover>
				{renderNullToggle()}
			</div>,
		);
	}

	// DateTime field with datetime-local input
	if (type === "datetime") {
		const datetimeValue = isNull
			? ""
			: value instanceof Date
				? value.toISOString().slice(0, 16)
				: value
					? new Date(String(value)).toISOString().slice(0, 16)
					: "";

		return renderFieldWrapper(
			<div className="space-y-2">
				<Input
					id={name}
					type="datetime-local"
					value={datetimeValue}
					onChange={(e) => {
						const val = e.target.value;
						if (val === "" && nullable) {
							onChange(null);
						} else {
							onChange(new Date(val));
						}
					}}
					disabled={isReadOnly || isNull}
					aria-invalid={!!error}
				/>
				{renderNullToggle()}
			</div>,
		);
	}

	// Time field with time input
	if (type === "time") {
		const timeValue = isNull ? "" : formatValueForDisplay(value, "time");

		return renderFieldWrapper(
			<div className="space-y-2">
				<Input
					id={name}
					type="time"
					value={timeValue}
					onChange={(e) => {
						const val = e.target.value;
						if (val === "" && nullable) {
							onChange(null);
						} else {
							onChange(val);
						}
					}}
					disabled={isReadOnly || isNull}
					aria-invalid={!!error}
				/>
				{renderNullToggle()}
			</div>,
		);
	}

	// Enum field with select
	if (type === "enum" && enumValues && enumValues.length > 0) {
		return renderFieldWrapper(
			<div className="space-y-2">
				<Select
					value={isNull ? "" : String(value ?? "")}
					onValueChange={(val) => onChange(val || (nullable ? null : ""))}
					disabled={isReadOnly || isNull}
				>
					<SelectTrigger aria-invalid={!!error} className="w-full">
						<SelectValue placeholder={isNull ? "NULL" : "Select an option"} />
					</SelectTrigger>
					<SelectContent>
						{enumValues.map((enumValue) => (
							<SelectItem key={enumValue} value={enumValue}>
								{enumValue}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{renderNullToggle()}
			</div>,
		);
	}

	// Default fallback - render as text input
	return renderFieldWrapper(
		<div className="space-y-2">
			<Input
				id={name}
				type="text"
				value={isNull ? "" : String(value ?? "")}
				onChange={(e) => onChange(e.target.value || (nullable ? null : ""))}
				disabled={isReadOnly || isNull}
				aria-invalid={!!error}
				placeholder={isNull ? "NULL" : undefined}
			/>
			{renderNullToggle()}
		</div>,
	);
}
