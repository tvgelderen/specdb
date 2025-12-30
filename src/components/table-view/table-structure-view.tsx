import * as React from "react";
import {
	KeyRoundIcon,
	LinkIcon,
	CircleDotIcon,
	HashIcon,
	TypeIcon,
	CalendarIcon,
	ToggleLeftIcon,
	BracesIcon,
	ListIcon,
	FileTextIcon,
	HelpCircleIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended column information with full metadata from pg_catalog
 */
export interface StructureColumnInfo {
	name: string;
	dataType: string;
	isNullable: boolean;
	defaultValue: string | null;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	characterMaxLength: number | null;
	numericPrecision: number | null;
	numericScale: number | null;
	ordinalPosition: number;
}

/**
 * Constraint information
 */
export interface StructureConstraintInfo {
	name: string;
	type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK" | "EXCLUSION";
	tableName: string;
	columns: string[];
	definition: string;
	referencedTable?: string;
	referencedColumns?: string[];
	updateRule?: string;
	deleteRule?: string;
	checkClause?: string;
}

/**
 * Index information
 */
export interface StructureIndexInfo {
	name: string;
	tableName: string;
	columns: string[];
	isUnique: boolean;
	isPrimary: boolean;
	indexType: string;
	definition: string;
	size: string | null;
}

/**
 * Props for TableStructureView component
 */
export interface TableStructureViewProps extends React.ComponentProps<"div"> {
	/** Column metadata from the database */
	columns: StructureColumnInfo[];
	/** Constraint metadata from the database */
	constraints?: StructureConstraintInfo[];
	/** Index metadata from the database */
	indexes?: StructureIndexInfo[];
	/** Whether the data is loading */
	loading?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely convert a columns value to an array of strings.
 * Handles cases where columns may be:
 * - A proper array of strings
 * - A PostgreSQL array string format like "{col1,col2}"
 * - A comma-separated string
 * - Null or undefined
 */
function normalizeColumnsToArray(columns: string[] | string | null | undefined): string[] {
	if (!columns) {
		return [];
	}
	if (Array.isArray(columns)) {
		return columns;
	}
	if (typeof columns === "string") {
		// Handle PostgreSQL array format: {col1,col2,col3}
		if (columns.startsWith("{") && columns.endsWith("}")) {
			const inner = columns.slice(1, -1);
			if (inner.length === 0) {
				return [];
			}
			return inner.split(",").map((s) => s.trim());
		}
		// Handle comma-separated string
		return columns.split(",").map((s) => s.trim());
	}
	return [];
}

/**
 * Get an icon for the data type
 */
function getDataTypeIcon(dataType: string): React.ComponentType<{ className?: string }> {
	const type = dataType.toLowerCase();

	// Numeric types
	if (
		type.includes("int") ||
		type.includes("serial") ||
		type.includes("numeric") ||
		type.includes("decimal") ||
		type.includes("float") ||
		type.includes("double") ||
		type.includes("real") ||
		type === "money"
	) {
		return HashIcon;
	}

	// Boolean
	if (type === "boolean" || type === "bool") {
		return ToggleLeftIcon;
	}

	// Date/Time
	if (
		type.includes("timestamp") ||
		type.includes("date") ||
		type.includes("time") ||
		type.includes("interval")
	) {
		return CalendarIcon;
	}

	// JSON
	if (type === "json" || type === "jsonb") {
		return BracesIcon;
	}

	// Array
	if (type.includes("array") || type.includes("[]")) {
		return ListIcon;
	}

	// Text/Character
	if (
		type.includes("char") ||
		type.includes("text") ||
		type.includes("varchar") ||
		type === "uuid" ||
		type === "citext"
	) {
		return TypeIcon;
	}

	// Binary/Bytea
	if (type === "bytea" || type.includes("binary")) {
		return FileTextIcon;
	}

	// Default
	return HelpCircleIcon;
}

/**
 * Format the data type for display
 */
function formatDataType(column: StructureColumnInfo): string {
	let type = column.dataType;

	// Add character length if applicable
	if (column.characterMaxLength !== null) {
		type = `${type}(${column.characterMaxLength})`;
	}

	// Add numeric precision and scale if applicable
	if (column.numericPrecision !== null) {
		if (column.numericScale !== null && column.numericScale > 0) {
			type = `${type}(${column.numericPrecision},${column.numericScale})`;
		} else if (column.dataType.toLowerCase() !== "integer" && column.dataType.toLowerCase() !== "bigint") {
			type = `${type}(${column.numericPrecision})`;
		}
	}

	return type;
}

/**
 * Format the default value for display
 */
function formatDefaultValue(defaultValue: string | null): React.ReactNode {
	if (defaultValue === null) {
		return <span className="text-muted-foreground italic">No default</span>;
	}

	// Truncate long default values
	const maxLength = 50;
	const displayValue =
		defaultValue.length > maxLength
			? `${defaultValue.slice(0, maxLength)}...`
			: defaultValue;

	return (
		<code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
			{displayValue}
		</code>
	);
}

/**
 * Get constraint badges for a column
 */
function getColumnConstraints(
	columnName: string,
	constraints: StructureConstraintInfo[]
): StructureConstraintInfo[] {
	return constraints.filter((c) => normalizeColumnsToArray(c.columns).includes(columnName));
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Column row in the structure table
 */
function ColumnRow({
	column,
	constraints = [],
}: {
	column: StructureColumnInfo;
	constraints?: StructureConstraintInfo[];
}) {
	const DataTypeIcon = getDataTypeIcon(column.dataType);
	const columnConstraints = getColumnConstraints(column.name, constraints);

	return (
		<tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
			{/* Column Name */}
			<td className="py-3 px-4">
				<div className="flex items-center gap-2">
					{column.isPrimaryKey && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-amber-500">
									<KeyRoundIcon className="size-4" />
								</span>
							</TooltipTrigger>
							<TooltipContent>Primary Key</TooltipContent>
						</Tooltip>
					)}
					{column.isForeignKey && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-blue-500">
									<LinkIcon className="size-4" />
								</span>
							</TooltipTrigger>
							<TooltipContent>Foreign Key</TooltipContent>
						</Tooltip>
					)}
					<span className="font-medium text-foreground">{column.name}</span>
				</div>
			</td>

			{/* Data Type */}
			<td className="py-3 px-4">
				<div className="flex items-center gap-2">
					<DataTypeIcon className="size-4 text-muted-foreground shrink-0" />
					<code className="text-sm font-mono text-foreground">
						{formatDataType(column)}
					</code>
				</div>
			</td>

			{/* Nullable */}
			<td className="py-3 px-4">
				{column.isNullable ? (
					<Badge variant="outline" className="text-muted-foreground">
						<CircleDotIcon className="size-3 mr-1" />
						NULL
					</Badge>
				) : (
					<Badge variant="secondary">
						NOT NULL
					</Badge>
				)}
			</td>

			{/* Default */}
			<td className="py-3 px-4">
				{formatDefaultValue(column.defaultValue)}
			</td>

			{/* Constraints */}
			<td className="py-3 px-4">
				<div className="flex flex-wrap gap-1">
					{columnConstraints.map((constraint) => (
						<ConstraintBadge key={constraint.name} constraint={constraint} />
					))}
					{columnConstraints.length === 0 && (
						<span className="text-muted-foreground text-sm">-</span>
					)}
				</div>
			</td>
		</tr>
	);
}

/**
 * Badge for a constraint
 */
function ConstraintBadge({ constraint }: { constraint: StructureConstraintInfo }) {
	const getBadgeVariant = () => {
		switch (constraint.type) {
			case "PRIMARY KEY":
				return "default";
			case "FOREIGN KEY":
				return "secondary";
			case "UNIQUE":
				return "outline";
			case "CHECK":
				return "outline";
			default:
				return "outline";
		}
	};

	const getLabel = () => {
		switch (constraint.type) {
			case "PRIMARY KEY":
				return "PK";
			case "FOREIGN KEY":
				return `FK → ${constraint.referencedTable}`;
			case "UNIQUE":
				return "UNIQUE";
			case "CHECK":
				return "CHECK";
			case "EXCLUSION":
				return "EXCL";
			default:
				return constraint.type;
		}
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge variant={getBadgeVariant()} className="cursor-help">
					{getLabel()}
				</Badge>
			</TooltipTrigger>
			<TooltipContent className="max-w-sm">
				<div className="space-y-1">
					<div className="font-medium">{constraint.name}</div>
					<code className="text-xs block whitespace-pre-wrap">
						{constraint.definition}
					</code>
					{constraint.type === "FOREIGN KEY" && constraint.updateRule && (
						<div className="text-xs">
							ON UPDATE: {constraint.updateRule}, ON DELETE: {constraint.deleteRule}
						</div>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Table header for the structure view
 */
function StructureTableHeader() {
	return (
		<thead className="bg-muted/50">
			<tr className="border-b border-border">
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Column
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Type
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Nullable
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Default
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Constraints
				</th>
			</tr>
		</thead>
	);
}

/**
 * Loading skeleton for the structure view
 */
function StructureTableSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<tbody>
			{Array.from({ length: rows }).map((_, index) => (
				<tr key={index} className="border-b border-border/50">
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-32" />
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-24" />
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-16" />
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-28" />
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-20" />
					</td>
				</tr>
			))}
		</tbody>
	);
}

/**
 * Indexes section
 */
function IndexesSection({ indexes }: { indexes: StructureIndexInfo[] }) {
	if (indexes.length === 0) {
		return null;
	}

	return (
		<div className="mt-6">
			<h3 className="text-sm font-semibold text-foreground mb-3">Indexes</h3>
			<div className="rounded-lg border border-border overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-muted/50">
						<tr className="border-b border-border">
							<th className="py-2 px-4 text-left text-sm font-semibold text-foreground">
								Name
							</th>
							<th className="py-2 px-4 text-left text-sm font-semibold text-foreground">
								Columns
							</th>
							<th className="py-2 px-4 text-left text-sm font-semibold text-foreground">
								Type
							</th>
							<th className="py-2 px-4 text-left text-sm font-semibold text-foreground">
								Properties
							</th>
						</tr>
					</thead>
					<tbody>
						{indexes.map((index) => (
							<tr key={index.name} className="border-b border-border/50 last:border-0">
								<td className="py-2 px-4">
									<code className="text-xs font-mono">{index.name}</code>
								</td>
								<td className="py-2 px-4">
									<span className="text-sm">{normalizeColumnsToArray(index.columns).join(", ")}</span>
								</td>
								<td className="py-2 px-4">
									<Badge variant="outline">{index.indexType}</Badge>
								</td>
								<td className="py-2 px-4">
									<div className="flex gap-1">
										{index.isPrimary && (
											<Badge variant="default">PRIMARY</Badge>
										)}
										{index.isUnique && !index.isPrimary && (
											<Badge variant="secondary">UNIQUE</Badge>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TableStructureView - Displays table column structure with rich formatting
 *
 * Shows column metadata including:
 * - Column name with key indicators (primary/foreign)
 * - Data type with precision/scale
 * - Nullability
 * - Default values
 * - Constraints (with tooltips for details)
 *
 * @example
 * ```tsx
 * <TableStructureView
 *   columns={columns}
 *   constraints={constraints}
 *   indexes={indexes}
 *   loading={isLoading}
 * />
 * ```
 */
export function TableStructureView({
	columns,
	constraints = [],
	indexes = [],
	loading = false,
	className,
	...props
}: TableStructureViewProps) {
	// Sort columns by ordinal position
	const sortedColumns = React.useMemo(
		() => [...columns].sort((a, b) => a.ordinalPosition - b.ordinalPosition),
		[columns]
	);

	return (
		<div
			data-slot="table-structure-view"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			{/* Columns Table */}
			<div className="rounded-lg border border-border overflow-hidden">
				<table className="w-full text-sm">
					<StructureTableHeader />
					{loading ? (
						<StructureTableSkeleton />
					) : (
						<tbody>
							{sortedColumns.map((column) => (
								<ColumnRow
									key={column.name}
									column={column}
									constraints={constraints}
								/>
							))}
						</tbody>
					)}
				</table>
			</div>

			{/* Summary */}
			{!loading && (
				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					<span>{columns.length} columns</span>
					<span>•</span>
					<span>{constraints.length} constraints</span>
					<span>•</span>
					<span>{indexes.length} indexes</span>
				</div>
			)}

			{/* Indexes Section */}
			{!loading && <IndexesSection indexes={indexes} />}
		</div>
	);
}

/**
 * Loading skeleton for the full structure view
 */
export function TableStructureViewSkeleton({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-structure-view-skeleton"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			<div className="rounded-lg border border-border overflow-hidden">
				<table className="w-full text-sm">
					<StructureTableHeader />
					<StructureTableSkeleton rows={5} />
				</table>
			</div>
			<div className="flex items-center gap-4">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-20" />
			</div>
		</div>
	);
}
