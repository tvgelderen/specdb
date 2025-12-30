import * as React from "react";
import { CopyIcon, CheckIcon, MaximizeIcon, BracesIcon, ListIcon, TypeIcon, FileTextIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

// ============================================================================
// Types
// ============================================================================

export type DataType = "json" | "array" | "string" | "unknown";

export interface CellDataViewerProps {
	/** The data value to display */
	value: unknown;
	/** The detected or specified data type */
	dataType?: DataType;
	/** Maximum length before truncating (default: 50) */
	maxLength?: number;
	/** Whether to show the data type badge */
	showTypeBadge?: boolean;
	/** Column name for context in the dialog */
	columnName?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect the data type of a value
 */
function detectDataType(value: unknown): DataType {
	if (Array.isArray(value)) {
		return "array";
	}
	if (value !== null && typeof value === "object") {
		return "json";
	}
	if (typeof value === "string") {
		return "string";
	}
	return "unknown";
}

/**
 * Format a value for preview display (truncated)
 */
function formatPreview(value: unknown, maxLength: number): string {
	if (Array.isArray(value)) {
		const str = JSON.stringify(value);
		if (str.length <= maxLength) return str;
		// Show first few items
		const firstItems = value
			.slice(0, 3)
			.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)));
		return `[${firstItems.join(", ")}${value.length > 3 ? `, ...` : ""}]`;
	}

	if (value !== null && typeof value === "object") {
		const str = JSON.stringify(value);
		if (str.length <= maxLength) return str;
		// Show truncated JSON
		return str.slice(0, maxLength - 3) + "...";
	}

	const str = String(value);
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - 3) + "...";
}

/**
 * Format a value for full display (pretty-printed)
 */
function formatFullValue(value: unknown, dataType: DataType): string {
	if (dataType === "array" || dataType === "json") {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

/**
 * Get the icon for a data type
 */
function getDataTypeIcon(dataType: DataType) {
	switch (dataType) {
		case "json":
			return BracesIcon;
		case "array":
			return ListIcon;
		case "string":
			return TypeIcon;
		default:
			return FileTextIcon;
	}
}

/**
 * Get a human-readable label for a data type
 */
function getDataTypeLabel(dataType: DataType, value: unknown): string {
	switch (dataType) {
		case "array":
			return Array.isArray(value) ? `Array[${value.length}]` : "Array";
		case "json":
			return "JSON";
		case "string":
			return typeof value === "string" ? `${value.length} chars` : "Text";
		default:
			return "Data";
	}
}

/**
 * Check if a value should have an expandable viewer
 */
export function shouldShowViewer(value: unknown, maxLength: number = 50): boolean {
	if (value === null || value === undefined) return false;

	// Arrays and objects always get a viewer if they have content
	if (Array.isArray(value) && value.length > 0) return true;
	if (typeof value === "object" && value !== null) {
		return Object.keys(value).length > 0;
	}

	// Long strings get a viewer
	if (typeof value === "string" && value.length > maxLength) return true;

	return false;
}

// ============================================================================
// Copy Button Component
// ============================================================================

function CopyButton({ value, className }: { value: string; className?: string }) {
	const [copied, setCopied] = React.useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	return (
		<Button variant="outline" size="sm" onClick={handleCopy} className={cn("gap-1.5", className)}>
			{copied ? (
				<>
					<CheckIcon className="size-4 text-success" />
					Copied
				</>
			) : (
				<>
					<CopyIcon className="size-4" />
					Copy
				</>
			)}
		</Button>
	);
}

// ============================================================================
// Full View Dialog Component
// ============================================================================

interface DataViewerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: unknown;
	dataType: DataType;
	columnName?: string;
}

function DataViewerDialog({ open, onOpenChange, value, dataType, columnName }: DataViewerDialogProps) {
	const formattedValue = formatFullValue(value, dataType);
	const Icon = getDataTypeIcon(dataType);
	const typeLabel = getDataTypeLabel(dataType, value);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Icon className="size-5" />
						{columnName ? `${columnName}` : "Cell Value"}
					</DialogTitle>
					<DialogDescription className="flex items-center gap-2">
						<Badge variant="secondary">{typeLabel}</Badge>
						{dataType === "string" && typeof value === "string" && (
							<span className="text-muted-foreground">{value.length.toLocaleString()} characters</span>
						)}
						{dataType === "array" && Array.isArray(value) && (
							<span className="text-muted-foreground">{value.length.toLocaleString()} items</span>
						)}
						{dataType === "json" && typeof value === "object" && value !== null && (
							<span className="text-muted-foreground">
								{Object.keys(value).length.toLocaleString()} keys
							</span>
						)}
					</DialogDescription>
				</DialogHeader>
				<div className="-mx-6 overflow-auto max-h-[60vh] px-6">
					<pre className="text-sm font-mono bg-muted/50 p-4 rounded-lg whitespace-pre-wrap break-words">
						{formattedValue}
					</pre>
				</div>
				<div className="flex justify-end pt-4">
					<CopyButton value={formattedValue} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ============================================================================
// Quick Preview Popover Component
// ============================================================================

interface DataViewerPopoverProps {
	value: unknown;
	dataType: DataType;
	children: React.ReactNode;
	onOpenFullView: () => void;
}

function DataViewerPopover({ value, dataType, children, onOpenFullView }: DataViewerPopoverProps) {
	const formattedValue = formatFullValue(value, dataType);
	const previewLines = formattedValue.split("\n").slice(0, 10);
	const hasMore = formattedValue.split("\n").length > 10;
	const Icon = getDataTypeIcon(dataType);
	const typeLabel = getDataTypeLabel(dataType, value);

	return (
		<Popover>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent className="w-96 p-0" align="start" side="bottom">
				<div className="flex items-center justify-between border-b px-3 py-2">
					<div className="flex items-center gap-2">
						<Icon className="size-4 text-muted-foreground" />
						<Badge variant="secondary" className="text-xs">
							{typeLabel}
						</Badge>
					</div>
					<Button variant="ghost" size="sm" onClick={onOpenFullView} className="gap-1 h-7 text-xs">
						<MaximizeIcon className="size-3" />
						Full View
					</Button>
				</div>
				<ScrollArea className="max-h-64">
					<pre className="text-xs font-mono p-3 whitespace-pre-wrap break-words">
						{previewLines.join("\n")}
						{hasMore && (
							<span className="text-muted-foreground block mt-2">
								... and {formattedValue.split("\n").length - 10} more lines
							</span>
						)}
					</pre>
				</ScrollArea>
				<div className="flex justify-between items-center border-t px-3 py-2">
					<span className="text-xs text-muted-foreground">
						{dataType === "string" && typeof value === "string"
							? `${value.length.toLocaleString()} chars`
							: dataType === "array" && Array.isArray(value)
								? `${value.length.toLocaleString()} items`
								: dataType === "json" && typeof value === "object" && value !== null
									? `${Object.keys(value).length.toLocaleString()} keys`
									: ""}
					</span>
					<CopyButton value={formattedValue} className="h-7 text-xs" />
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ============================================================================
// Main CellDataViewer Component
// ============================================================================

/**
 * CellDataViewer - A component for viewing large or complex cell data
 *
 * Displays a truncated preview inline with the option to view the full content
 * in a popover (for quick glances) or a dialog (for detailed viewing).
 *
 * Features:
 * - Automatic data type detection (JSON, Array, String)
 * - Truncated preview with character/item count
 * - Popover for quick preview with syntax highlighting
 * - Full-screen dialog for detailed viewing
 * - Copy to clipboard functionality
 * - Customizable truncation length
 *
 * @example
 * ```tsx
 * // For a JSON object
 * <CellDataViewer
 *   value={{ name: "John", items: [1, 2, 3] }}
 *   columnName="data"
 * />
 *
 * // For an array
 * <CellDataViewer
 *   value={[1, 2, 3, 4, 5]}
 *   columnName="ids"
 * />
 *
 * // For a long string
 * <CellDataViewer
 *   value="A very long string that should be truncated..."
 *   maxLength={50}
 * />
 * ```
 */
export function CellDataViewer({
	value,
	dataType: explicitDataType,
	maxLength = 50,
	showTypeBadge = true,
	columnName,
}: CellDataViewerProps) {
	const [dialogOpen, setDialogOpen] = React.useState(false);

	const dataType = explicitDataType ?? detectDataType(value);
	const preview = formatPreview(value, maxLength);
	const needsViewer = shouldShowViewer(value, maxLength);
	const Icon = getDataTypeIcon(dataType);
	const typeLabel = getDataTypeLabel(dataType, value);

	// If it doesn't need a viewer, just show the value inline
	if (!needsViewer) {
		return <span className="font-mono text-xs">{preview}</span>;
	}

	return (
		<>
			<DataViewerPopover value={value} dataType={dataType} onOpenFullView={() => setDialogOpen(true)}>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-1.5 max-w-xs",
						"text-left font-mono text-xs",
						"px-2 py-1 rounded-md",
						"bg-muted/50 hover:bg-muted",
						"border border-transparent hover:border-border",
						"transition-colors cursor-pointer",
						"focus:outline-none",
					)}
				>
					{showTypeBadge && (
						<span className="inline-flex items-center gap-1 shrink-0 text-muted-foreground">
							<Icon className="size-3" />
							<span className="text-[10px] uppercase tracking-wider">{typeLabel}</span>
						</span>
					)}
					<span className="truncate">{preview}</span>
				</button>
			</DataViewerPopover>

			<DataViewerDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				value={value}
				dataType={dataType}
				columnName={columnName}
			/>
		</>
	);
}

// ============================================================================
// Exports
// ============================================================================

export { DataViewerDialog, DataViewerPopover, CopyButton };
