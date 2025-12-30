import * as React from "react";
import {
	KeyRoundIcon,
	LinkIcon,
	FingerprintIcon,
	ShieldCheckIcon,
	BanIcon,
	ArrowRightIcon,
	ChevronDownIcon,
	ChevronRightIcon,
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
 * Constraint information for the constraints view
 */
export interface ConstraintInfo {
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
 * Props for TableConstraintsView component
 */
export interface TableConstraintsViewProps extends React.ComponentProps<"div"> {
	/** Constraint metadata from the database */
	constraints: ConstraintInfo[];
	/** Whether the data is loading */
	loading?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get an icon for the constraint type
 */
function getConstraintIcon(
	type: ConstraintInfo["type"]
): React.ComponentType<{ className?: string }> {
	switch (type) {
		case "PRIMARY KEY":
			return KeyRoundIcon;
		case "FOREIGN KEY":
			return LinkIcon;
		case "UNIQUE":
			return FingerprintIcon;
		case "CHECK":
			return ShieldCheckIcon;
		case "EXCLUSION":
			return BanIcon;
		default:
			return ShieldCheckIcon;
	}
}

/**
 * Get the color class for a constraint type
 */
function getConstraintColorClass(type: ConstraintInfo["type"]): string {
	switch (type) {
		case "PRIMARY KEY":
			return "text-amber-500";
		case "FOREIGN KEY":
			return "text-blue-500";
		case "UNIQUE":
			return "text-purple-500";
		case "CHECK":
			return "text-green-500";
		case "EXCLUSION":
			return "text-orange-500";
		default:
			return "text-muted-foreground";
	}
}

/**
 * Get badge variant for constraint type
 */
function getConstraintBadgeVariant(
	type: ConstraintInfo["type"]
): "default" | "secondary" | "outline" {
	switch (type) {
		case "PRIMARY KEY":
			return "default";
		case "FOREIGN KEY":
			return "secondary";
		default:
			return "outline";
	}
}

/**
 * Get a short label for the constraint type
 */
function getConstraintTypeLabel(type: ConstraintInfo["type"]): string {
	switch (type) {
		case "PRIMARY KEY":
			return "PRIMARY KEY";
		case "FOREIGN KEY":
			return "FOREIGN KEY";
		case "UNIQUE":
			return "UNIQUE";
		case "CHECK":
			return "CHECK";
		case "EXCLUSION":
			return "EXCLUSION";
		default:
			return type;
	}
}

/**
 * Format action rule for display
 */
function formatActionRule(rule: string | undefined): string {
	if (!rule) return "NO ACTION";
	return rule.toUpperCase().replace(/_/g, " ");
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Section header for constraint type grouping
 */
function ConstraintSectionHeader({
	type,
	count,
}: {
	type: ConstraintInfo["type"];
	count: number;
}) {
	const Icon = getConstraintIcon(type);
	const colorClass = getConstraintColorClass(type);

	return (
		<div className="flex items-center gap-2 py-2 px-1">
			<Icon className={cn("size-4", colorClass)} />
			<span className="text-sm font-semibold text-foreground">
				{getConstraintTypeLabel(type)}
			</span>
			<Badge variant="outline" className="text-xs">
				{count}
			</Badge>
		</div>
	);
}

/**
 * Foreign key relationship visual indicator
 */
function ForeignKeyRelationship({
	constraint,
}: {
	constraint: ConstraintInfo;
}) {
	if (constraint.type !== "FOREIGN KEY" || !constraint.referencedTable) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 text-sm">
			<div className="flex items-center gap-1">
				<code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
					{normalizeColumnsToArray(constraint.columns).join(", ")}
				</code>
			</div>
			<ArrowRightIcon className="size-4 text-blue-500 shrink-0" />
			<div className="flex items-center gap-1">
				<code className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono">
					{constraint.referencedTable}
				</code>
				<span className="text-muted-foreground">(</span>
				<code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
					{normalizeColumnsToArray(constraint.referencedColumns).join(", ")}
				</code>
				<span className="text-muted-foreground">)</span>
			</div>
		</div>
	);
}

/**
 * Action rules display for foreign keys
 */
function ForeignKeyActions({ constraint }: { constraint: ConstraintInfo }) {
	if (constraint.type !== "FOREIGN KEY") {
		return null;
	}

	return (
		<div className="flex items-center gap-4 text-xs text-muted-foreground">
			<div className="flex items-center gap-1">
				<span>ON UPDATE:</span>
				<Badge variant="outline" className="text-xs py-0">
					{formatActionRule(constraint.updateRule)}
				</Badge>
			</div>
			<div className="flex items-center gap-1">
				<span>ON DELETE:</span>
				<Badge variant="outline" className="text-xs py-0">
					{formatActionRule(constraint.deleteRule)}
				</Badge>
			</div>
		</div>
	);
}

/**
 * Expandable constraint row
 */
function ConstraintRow({ constraint }: { constraint: ConstraintInfo }) {
	const [isExpanded, setIsExpanded] = React.useState(false);
	const Icon = getConstraintIcon(constraint.type);
	const colorClass = getConstraintColorClass(constraint.type);

	return (
		<div className="border-b border-border/50 last:border-0">
			{/* Main Row */}
			<div
				className={cn(
					"flex items-start gap-4 py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer"
				)}
				onClick={() => setIsExpanded(!isExpanded)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setIsExpanded(!isExpanded);
					}
				}}
				role="button"
				tabIndex={0}
				aria-expanded={isExpanded}
			>
				{/* Expand/Collapse Icon */}
				<div className="pt-0.5">
					{isExpanded ? (
						<ChevronDownIcon className="size-4 text-muted-foreground" />
					) : (
						<ChevronRightIcon className="size-4 text-muted-foreground" />
					)}
				</div>

				{/* Constraint Icon */}
				<div className="pt-0.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<span className={colorClass}>
								<Icon className="size-4" />
							</span>
						</TooltipTrigger>
						<TooltipContent>{constraint.type}</TooltipContent>
					</Tooltip>
				</div>

				{/* Constraint Name and Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<code className="text-sm font-mono font-medium text-foreground">
							{constraint.name}
						</code>
						<Badge
							variant={getConstraintBadgeVariant(constraint.type)}
							className="text-xs"
						>
							{getConstraintTypeLabel(constraint.type)}
						</Badge>
					</div>

					{/* Quick Preview */}
					<div className="mt-1">
						{constraint.type === "FOREIGN KEY" ? (
							<ForeignKeyRelationship constraint={constraint} />
						) : constraint.type === "CHECK" ? (
							<code className="text-xs text-muted-foreground font-mono block truncate max-w-md">
								{constraint.checkClause || constraint.definition}
							</code>
						) : (
							<span className="text-xs text-muted-foreground">
								Columns: {normalizeColumnsToArray(constraint.columns).join(", ")}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Expanded Details */}
			{isExpanded && (
				<div className="px-4 pb-4 pl-14 space-y-3 bg-muted/20">
					{/* Columns */}
					<div>
						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Columns
						</span>
						<div className="mt-1 flex flex-wrap gap-1">
							{normalizeColumnsToArray(constraint.columns).map((column) => (
								<Badge key={column} variant="outline" className="font-mono text-xs">
									{column}
								</Badge>
							))}
						</div>
					</div>

					{/* Foreign Key Specific: Referenced Table */}
					{constraint.type === "FOREIGN KEY" && constraint.referencedTable && (
						<div>
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								References
							</span>
							<div className="mt-1">
								<ForeignKeyRelationship constraint={constraint} />
							</div>
						</div>
					)}

					{/* Foreign Key Specific: Actions */}
					{constraint.type === "FOREIGN KEY" && (
						<div>
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								Referential Actions
							</span>
							<div className="mt-1">
								<ForeignKeyActions constraint={constraint} />
							</div>
						</div>
					)}

					{/* Check Constraint Specific: Check Clause */}
					{constraint.type === "CHECK" && constraint.checkClause && (
						<div>
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								Check Condition
							</span>
							<div className="mt-1">
								<code className="text-xs bg-muted px-2 py-1 rounded font-mono block whitespace-pre-wrap">
									{constraint.checkClause}
								</code>
							</div>
						</div>
					)}

					{/* Full Definition */}
					<div>
						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Definition
						</span>
						<div className="mt-1">
							<code className="text-xs bg-muted px-2 py-1 rounded font-mono block whitespace-pre-wrap overflow-x-auto">
								{constraint.definition}
							</code>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * Table header for constraints view
 */
function ConstraintsTableHeader() {
	return (
		<thead className="bg-muted/50">
			<tr className="border-b border-border">
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground w-8">
					{/* Expand column */}
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground w-8">
					{/* Icon column */}
				</th>
				<th className="py-3 px-4 text-left text-sm font-semibold text-foreground">
					Constraint
				</th>
			</tr>
		</thead>
	);
}

/**
 * Loading skeleton for constraints view
 */
function ConstraintsTableSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<div className="space-y-2">
			{Array.from({ length: rows }).map((_, index) => (
				<div
					key={index}
					className="flex items-center gap-4 py-3 px-4 border-b border-border/50"
				>
					<Skeleton className="h-4 w-4" />
					<Skeleton className="h-4 w-4" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-4 w-32" />
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * Empty state for no constraints
 */
function ConstraintsEmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheckIcon className="size-12 text-muted-foreground/50 mb-4" />
			<p className="text-muted-foreground text-sm">
				No constraints defined for this table
			</p>
		</div>
	);
}

/**
 * Group constraints by type
 */
function groupConstraintsByType(
	constraints: ConstraintInfo[]
): Map<ConstraintInfo["type"], ConstraintInfo[]> {
	const groups = new Map<ConstraintInfo["type"], ConstraintInfo[]>();

	// Define order of constraint types
	const typeOrder: ConstraintInfo["type"][] = [
		"PRIMARY KEY",
		"FOREIGN KEY",
		"UNIQUE",
		"CHECK",
		"EXCLUSION",
	];

	// Initialize groups in order
	for (const type of typeOrder) {
		groups.set(type, []);
	}

	// Populate groups
	for (const constraint of constraints) {
		const existing = groups.get(constraint.type) ?? [];
		existing.push(constraint);
		groups.set(constraint.type, existing);
	}

	// Remove empty groups
	for (const [type, items] of groups) {
		if (items.length === 0) {
			groups.delete(type);
		}
	}

	return groups;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TableConstraintsView - Displays table constraints with rich formatting
 *
 * Shows constraint metadata including:
 * - Primary keys with column indicators
 * - Foreign keys with visual relationship indicators
 * - Unique constraints
 * - Check constraints with condition display
 * - Exclusion constraints
 *
 * Features:
 * - Grouped by constraint type
 * - Expandable rows for detailed view
 * - Visual relationship indicators for foreign keys
 * - Referential action display (ON UPDATE/DELETE)
 *
 * @example
 * ```tsx
 * <TableConstraintsView
 *   constraints={constraints}
 *   loading={isLoading}
 * />
 * ```
 */
export function TableConstraintsView({
	constraints,
	loading = false,
	className,
	...props
}: TableConstraintsViewProps) {
	const groupedConstraints = React.useMemo(
		() => groupConstraintsByType(constraints),
		[constraints]
	);

	if (loading) {
		return (
			<div
				data-slot="table-constraints-view"
				className={cn("flex flex-col gap-4", className)}
				{...props}
			>
				<div className="rounded-lg border border-border overflow-hidden">
					<ConstraintsTableSkeleton />
				</div>
			</div>
		);
	}

	if (constraints.length === 0) {
		return (
			<div
				data-slot="table-constraints-view"
				className={cn("flex flex-col gap-4", className)}
				{...props}
			>
				<div className="rounded-lg border border-border overflow-hidden">
					<ConstraintsEmptyState />
				</div>
			</div>
		);
	}

	return (
		<div
			data-slot="table-constraints-view"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			{/* Summary */}
			<div className="flex items-center gap-4 text-sm text-muted-foreground">
				<span>{constraints.length} constraint{constraints.length !== 1 ? "s" : ""}</span>
				{Array.from(groupedConstraints.entries()).map(([type, items]) => (
					<React.Fragment key={type}>
						<span>•</span>
						<span className="flex items-center gap-1">
							{React.createElement(getConstraintIcon(type), {
								className: cn("size-3", getConstraintColorClass(type)),
							})}
							{items.length} {type.toLowerCase()}
						</span>
					</React.Fragment>
				))}
			</div>

			{/* Constraints grouped by type */}
			{Array.from(groupedConstraints.entries()).map(([type, items]) => (
				<div key={type} className="rounded-lg border border-border overflow-hidden">
					<ConstraintSectionHeader type={type} count={items.length} />
					<div className="border-t border-border">
						{items.map((constraint) => (
							<ConstraintRow key={constraint.name} constraint={constraint} />
						))}
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * Loading skeleton for the full constraints view
 */
export function TableConstraintsViewSkeleton({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-constraints-view-skeleton"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			<div className="flex items-center gap-4">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-4 w-28" />
			</div>
			<div className="rounded-lg border border-border overflow-hidden">
				<ConstraintsTableSkeleton rows={3} />
			</div>
			<div className="rounded-lg border border-border overflow-hidden">
				<ConstraintsTableSkeleton rows={2} />
			</div>
		</div>
	);
}
