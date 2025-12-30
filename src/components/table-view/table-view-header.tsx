import * as React from "react";
import { TableIcon, EyeIcon, LayersIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { TimingBadge, type TimingMetrics } from "~/components/ui/timing-badge";
import type { TableIdentifier } from "./types";

/**
 * Icon mapping for table types
 */
const TABLE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	table: TableIcon,
	view: EyeIcon,
	materialized_view: LayersIcon,
};

/**
 * Human-readable labels for table types
 */
const TABLE_TYPE_LABELS: Record<string, string> = {
	table: "Table",
	view: "View",
	materialized_view: "Materialized View",
};

/**
 * Props for TableViewHeader component
 */
export interface TableViewHeaderProps extends React.ComponentProps<"div"> {
	/** Table identification info */
	tableInfo: TableIdentifier;
	/** Total row count (approximate or exact) */
	rowCount?: number | null;
	/** Whether row count is an estimate vs exact */
	isRowCountEstimate?: boolean;
	/** Whether the table data is currently loading */
	isLoading?: boolean;
	/** Callback when refresh button is clicked */
	onRefresh?: () => void;
	/** Whether refresh is in progress */
	isRefreshing?: boolean;
	/** Query timing metrics (optional) */
	timing?: TimingMetrics | null;
}

/**
 * TableViewHeader - Displays schema.table name with type icon and row count
 *
 * Shows the qualified table name (schema.table) along with:
 * - An icon indicating the table type (table, view, materialized view)
 * - A badge showing the row count
 * - A refresh button to reload the data
 */
export function TableViewHeader({
	tableInfo,
	rowCount,
	isRowCountEstimate = false,
	isLoading = false,
	onRefresh,
	isRefreshing = false,
	timing,
	className,
	...props
}: TableViewHeaderProps) {
	const { schema, table, type = "table" } = tableInfo;
	const IconComponent = TABLE_TYPE_ICONS[type] ?? TableIcon;
	const typeLabel = TABLE_TYPE_LABELS[type] ?? "Table";

	return (
		<div
			data-slot="table-view-header"
			className={cn(
				"flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4",
				className
			)}
			{...props}
		>
			{/* Table name and type */}
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex items-center justify-center size-10 rounded-lg bg-muted shrink-0">
					<IconComponent className="size-5 text-muted-foreground" />
				</div>
				<div className="min-w-0">
					<h1 className="text-xl font-header font-semibold text-foreground truncate">
						<span className="text-muted-foreground">{schema}</span>
						<span className="text-muted-foreground/60">.</span>
						<span>{table}</span>
					</h1>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>{typeLabel}</span>
						{isLoading ? (
							<Skeleton className="h-4 w-16" />
						) : rowCount !== undefined && rowCount !== null ? (
							<Badge variant="secondary" className="text-xs">
								{isRowCountEstimate && "~"}
								{formatRowCount(rowCount)} rows
							</Badge>
						) : null}
						{/* Timing badge - shown after row count when timing data is available */}
						{!isLoading && timing && (
							<TimingBadge
								timing={timing}
								showIcon={false}
								variant="outline"
							/>
						)}
					</div>
				</div>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-2 shrink-0">
				{onRefresh && (
					<Button
						variant="outline"
						size="sm"
						onClick={onRefresh}
						disabled={isRefreshing}
						className="gap-2"
					>
						<RefreshCwIcon
							className={cn("size-4", isRefreshing && "animate-spin")}
						/>
						<span className="hidden sm:inline">Refresh</span>
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * Loading skeleton for TableViewHeader
 */
export function TableViewHeaderSkeleton({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-view-header-skeleton"
			className={cn(
				"flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4",
				className
			)}
			{...props}
		>
			<div className="flex items-center gap-3">
				<Skeleton className="size-10 rounded-lg" />
				<div className="space-y-2">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-24" />
				</div>
			</div>
			<Skeleton className="h-8 w-24" />
		</div>
	);
}

/**
 * Format row count with thousands separators
 */
function formatRowCount(count: number): string {
	return new Intl.NumberFormat().format(count);
}
