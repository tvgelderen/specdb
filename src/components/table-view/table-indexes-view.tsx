import * as React from "react";
import { DatabaseIcon, HardDriveIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "~/components/ui/empty";

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

// ============================================================================
// Types
// ============================================================================

/**
 * Index information for the indexes view
 */
export interface IndexViewInfo {
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
 * Props for TableIndexesView component
 */
export interface TableIndexesViewProps extends React.ComponentProps<"div"> {
	/** Index metadata from the database */
	indexes: IndexViewInfo[];
	/** Whether the data is loading */
	loading?: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Table header for the indexes view
 */
function IndexesTableHeader() {
	return (
		<thead className="bg-muted/50">
			<tr className="border-b border-border">
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Name
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Columns
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Uniqueness
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Method
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Size
				</th>
			</tr>
		</thead>
	);
}

/**
 * Index row in the indexes table
 */
function IndexRow({ index }: { index: IndexViewInfo }) {
	return (
		<tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
			{/* Index Name */}
			<td className="py-3 px-4">
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-2 cursor-help">
							<DatabaseIcon className="size-4 text-muted-foreground shrink-0" />
							<code className="text-sm font-mono text-foreground">
								{index.name}
							</code>
						</div>
					</TooltipTrigger>
					<TooltipContent className="max-w-md">
						<div className="space-y-1">
							<div className="font-medium">Index Definition</div>
							<code className="text-xs block whitespace-pre-wrap break-all">
								{index.definition}
							</code>
						</div>
					</TooltipContent>
				</Tooltip>
			</td>

			{/* Columns */}
			<td className="py-3 px-4">
				<div className="flex flex-wrap gap-1">
					{normalizeColumnsToArray(index.columns).map((column, idx) => (
						<Badge key={idx} variant="outline" className="font-mono text-xs">
							{column}
						</Badge>
					))}
				</div>
			</td>

			{/* Uniqueness */}
			<td className="py-3 px-4">
				{index.isPrimary ? (
					<Badge variant="default">PRIMARY</Badge>
				) : index.isUnique ? (
					<Badge variant="secondary">UNIQUE</Badge>
				) : (
					<Badge variant="outline" className="text-muted-foreground">
						NON-UNIQUE
					</Badge>
				)}
			</td>

			{/* Method/Type */}
			<td className="py-3 px-4">
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="outline" className="cursor-help uppercase">
							{index.indexType}
						</Badge>
					</TooltipTrigger>
					<TooltipContent>
						<div className="text-xs">
							{getIndexTypeDescription(index.indexType)}
						</div>
					</TooltipContent>
				</Tooltip>
			</td>

			{/* Size */}
			<td className="py-3 px-4">
				{index.size ? (
					<div className="flex items-center gap-2">
						<HardDriveIcon className="size-4 text-muted-foreground shrink-0" />
						<span className="text-sm text-foreground">{index.size}</span>
					</div>
				) : (
					<span className="text-muted-foreground text-sm">-</span>
				)}
			</td>
		</tr>
	);
}

/**
 * Get a description for the index type
 */
function getIndexTypeDescription(indexType: string): string {
	const type = indexType.toLowerCase();
	switch (type) {
		case "btree":
			return "B-tree index - Good for equality and range queries. Most common index type.";
		case "hash":
			return "Hash index - Optimized for simple equality comparisons.";
		case "gist":
			return "GiST index - Generalized Search Tree for complex data types like geometric and full-text.";
		case "spgist":
			return "SP-GiST index - Space-partitioned GiST for non-balanced data structures.";
		case "gin":
			return "GIN index - Generalized Inverted Index for values containing multiple elements (arrays, JSONB, full-text).";
		case "brin":
			return "BRIN index - Block Range Index for very large tables with naturally ordered data.";
		default:
			return `${indexType} index`;
	}
}

/**
 * Loading skeleton for the indexes table
 */
function IndexesTableSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<tbody>
			{Array.from({ length: rows }).map((_, index) => (
				<tr key={index} className="border-b border-border/50">
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-40" />
					</td>
					<td className="py-3 px-4">
						<div className="flex gap-1">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-16" />
						</div>
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-20" />
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-16" />
					</td>
					<td className="py-3 px-4">
						<Skeleton className="h-5 w-16" />
					</td>
				</tr>
			))}
		</tbody>
	);
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TableIndexesView - Displays table index information with rich formatting
 *
 * Shows index metadata including:
 * - Index name with definition tooltip
 * - Column names
 * - Uniqueness (PRIMARY, UNIQUE, NON-UNIQUE)
 * - Index method/type (btree, hash, gist, etc.)
 * - Index size
 *
 * @example
 * ```tsx
 * <TableIndexesView
 *   indexes={indexes}
 *   loading={isLoading}
 * />
 * ```
 */
export function TableIndexesView({
	indexes,
	loading = false,
	className,
	...props
}: TableIndexesViewProps) {
	// Sort indexes: primary first, then unique, then by name
	const sortedIndexes = React.useMemo(
		() =>
			[...indexes].sort((a, b) => {
				// Primary indexes first
				if (a.isPrimary && !b.isPrimary) return -1;
				if (!a.isPrimary && b.isPrimary) return 1;
				// Then unique indexes
				if (a.isUnique && !b.isUnique) return -1;
				if (!a.isUnique && b.isUnique) return 1;
				// Then by name
				return a.name.localeCompare(b.name);
			}),
		[indexes]
	);

	if (!loading && indexes.length === 0) {
		return (
			<Empty className={className}>
				<EmptyHeader>
					<DatabaseIcon className="size-12 text-muted-foreground/50" />
					<EmptyTitle>No indexes</EmptyTitle>
					<EmptyDescription>
						This table has no indexes defined.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div
			data-slot="table-indexes-view"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			{/* Indexes Table */}
			<div className="rounded-lg border border-border overflow-hidden">
				<table className="w-full text-sm">
					<IndexesTableHeader />
					{loading ? (
						<IndexesTableSkeleton />
					) : (
						<tbody>
							{sortedIndexes.map((index) => (
								<IndexRow key={index.name} index={index} />
							))}
						</tbody>
					)}
				</table>
			</div>

			{/* Summary */}
			{!loading && (
				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					<span>{indexes.length} {indexes.length === 1 ? "index" : "indexes"}</span>
					{indexes.filter((i) => i.isPrimary).length > 0 && (
						<>
							<span>•</span>
							<span>
								{indexes.filter((i) => i.isPrimary).length} primary
							</span>
						</>
					)}
					{indexes.filter((i) => i.isUnique && !i.isPrimary).length > 0 && (
						<>
							<span>•</span>
							<span>
								{indexes.filter((i) => i.isUnique && !i.isPrimary).length} unique
							</span>
						</>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Loading skeleton for the full indexes view
 */
export function TableIndexesViewSkeleton({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-indexes-view-skeleton"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			<div className="rounded-lg border border-border overflow-hidden">
				<table className="w-full text-sm">
					<IndexesTableHeader />
					<IndexesTableSkeleton rows={5} />
				</table>
			</div>
			<div className="flex items-center gap-4">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-24" />
			</div>
		</div>
	);
}
