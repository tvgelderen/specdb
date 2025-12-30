import * as React from "react";
import { ChevronRightIcon, DatabaseIcon, FolderIcon, TableIcon, EyeIcon, LayersIcon, AlertCircleIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import type { TreeNodeMeta, TreeNodeType } from "~/trpc/explorer/types";

/**
 * Icon mapping for tree node types
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
	database: DatabaseIcon,
	folder: FolderIcon,
	table: TableIcon,
	eye: EyeIcon,
	layers: LayersIcon,
};

/**
 * Get the appropriate icon component for a tree node
 */
function getNodeIcon(icon?: string): React.ComponentType<{ className?: string }> {
	return ICON_MAP[icon ?? "folder"] ?? FolderIcon;
}

/**
 * Props for TreeNode component
 */
export interface TreeNodeProps {
	/** Unique identifier for the node */
	id: string;
	/** Display label for the node */
	label: string;
	/** Tree metadata with type and expandability info */
	treeMeta: TreeNodeMeta;
	/** Current depth level (0 = root) */
	depth: number;
	/** Whether this node is currently expanded */
	isExpanded?: boolean;
	/** Whether this node is currently selected */
	isSelected?: boolean;
	/** Whether children are currently loading */
	isLoading?: boolean;
	/** Whether there was an error loading children */
	hasError?: boolean;
	/** Error message to display */
	errorMessage?: string;
	/** Callback when expand/collapse is toggled */
	onToggle?: () => void;
	/** Callback when node is clicked/selected */
	onSelect?: () => void;
	/** Child nodes (rendered when expanded) */
	children?: React.ReactNode;
	/** Optional actions element to render (shown on hover) */
	actions?: React.ReactNode;
}

/**
 * Calculate indentation based on depth
 */
function getIndentStyle(depth: number): React.CSSProperties {
	return {
		paddingLeft: `${depth * 16 + 8}px`,
	};
}

/**
 * TreeNode - A single node in the explorer tree
 * Supports expand/collapse, selection, loading states, and nested children
 */
export function TreeNode({
	id,
	label,
	treeMeta,
	depth,
	isExpanded = false,
	isSelected = false,
	isLoading = false,
	hasError = false,
	errorMessage,
	onToggle,
	onSelect,
	children,
	actions,
}: TreeNodeProps) {
	const IconComponent = getNodeIcon(treeMeta.icon);
	const canExpand = treeMeta.isExpandable;
	const [isHovered, setIsHovered] = React.useState(false);

	const handleToggle = React.useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (canExpand && onToggle) {
				onToggle();
			}
		},
		[canExpand, onToggle]
	);

	const handleSelect = React.useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (onSelect) {
				onSelect();
			}
		},
		[onSelect]
	);

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				if (onSelect) {
					onSelect();
				}
			}
			if (e.key === "ArrowRight" && canExpand && !isExpanded && onToggle) {
				e.preventDefault();
				onToggle();
			}
			if (e.key === "ArrowLeft" && canExpand && isExpanded && onToggle) {
				e.preventDefault();
				onToggle();
			}
		},
		[canExpand, isExpanded, onToggle, onSelect]
	);

	return (
		<div data-slot="tree-node" data-node-id={id} data-node-type={treeMeta.type}>
			{/* Node row */}
			<div
				role="treeitem"
				tabIndex={0}
				aria-expanded={canExpand ? isExpanded : undefined}
				aria-selected={isSelected}
				className={cn(
					"group flex items-center gap-1 h-8 pr-2 cursor-pointer select-none",
					"rounded-md transition-colors duration-150",
					"hover:bg-accent focus-visible:bg-accent",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
					isSelected && "bg-accent text-accent-foreground font-medium",
					hasError && "text-destructive"
				)}
				style={getIndentStyle(depth)}
				onClick={handleSelect}
				onDoubleClick={handleToggle}
				onKeyDown={handleKeyDown}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				{/* Expand/collapse button */}
				<button
					type="button"
					className={cn(
						"flex items-center justify-center size-5 shrink-0 rounded-sm",
						"hover:bg-muted/50 transition-colors",
						!canExpand && "invisible"
					)}
					onClick={handleToggle}
					disabled={!canExpand}
					aria-label={isExpanded ? "Collapse" : "Expand"}
					tabIndex={-1}
				>
					<ChevronRightIcon
						className={cn(
							"size-4 text-muted-foreground transition-transform duration-200",
							isExpanded && "rotate-90"
						)}
					/>
				</button>

				{/* Node icon */}
				{hasError ? (
					<AlertCircleIcon className="size-4 shrink-0 text-destructive" />
				) : (
					<IconComponent className="size-4 shrink-0 text-muted-foreground" />
				)}

				{/* Label */}
				<span className="truncate text-sm flex-1">{label}</span>

				{/* Loading indicator */}
				{isLoading && (
					<span className="shrink-0">
						<span className="size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent inline-block" />
					</span>
				)}

				{/* Actions (context menu) - shown on hover */}
				{actions && (
					<div className="shrink-0">
						{React.isValidElement(actions)
							? React.cloneElement(actions as React.ReactElement<{ isVisible?: boolean }>, {
									isVisible: isHovered,
								})
							: actions}
					</div>
				)}
			</div>

			{/* Children container - only render when expanded */}
			{isExpanded && canExpand && (
				<div role="group" aria-label={`${label} contents`}>
					{children}
				</div>
			)}
		</div>
	);
}

/**
 * Props for TreeNodeSkeleton component
 */
export interface TreeNodeSkeletonProps {
	/** Number of skeleton nodes to render */
	count?: number;
	/** Depth level for indentation */
	depth: number;
}

/**
 * TreeNodeSkeleton - Loading placeholder for tree nodes
 */
export function TreeNodeSkeleton({ count = 3, depth }: TreeNodeSkeletonProps) {
	return (
		<>
			{Array.from({ length: count }).map((_, index) => (
				<div
					key={index}
					className="flex items-center gap-2 h-8 pr-2"
					style={getIndentStyle(depth)}
				>
					<Skeleton className="size-5" />
					<Skeleton className="size-4" />
					<Skeleton className="h-4 flex-1 max-w-[120px]" />
				</div>
			))}
		</>
	);
}

/**
 * TreeNodeError - Error state display for tree loading errors
 */
export interface TreeNodeErrorProps {
	/** Error message to display */
	message: string;
	/** Depth level for indentation */
	depth: number;
	/** Optional retry callback */
	onRetry?: () => void;
}

export function TreeNodeError({ message, depth, onRetry }: TreeNodeErrorProps) {
	return (
		<div
			className="flex items-center gap-2 h-8 pr-2 text-sm text-destructive"
			style={getIndentStyle(depth)}
		>
			<AlertCircleIcon className="size-4 shrink-0" />
			<span className="truncate">{message}</span>
			{onRetry && (
				<button
					type="button"
					className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
					onClick={onRetry}
				>
					Retry
				</button>
			)}
		</div>
	);
}

/**
 * TreeNodeEmpty - Empty state for when a node has no children
 */
export interface TreeNodeEmptyProps {
	/** Message to display */
	message?: string;
	/** Depth level for indentation */
	depth: number;
}

export function TreeNodeEmpty({ message = "No items", depth }: TreeNodeEmptyProps) {
	return (
		<div
			className="flex items-center gap-2 h-8 pr-2 text-sm text-muted-foreground italic"
			style={getIndentStyle(depth)}
		>
			<span className="truncate">{message}</span>
		</div>
	);
}

/**
 * TreeLoadMore - "Load more" button for paginated results
 */
export interface TreeLoadMoreProps {
	/** Number of remaining items */
	remaining?: number;
	/** Depth level for indentation */
	depth: number;
	/** Whether loading is in progress */
	isLoading?: boolean;
	/** Callback when clicked */
	onLoadMore: () => void;
}

export function TreeLoadMore({ remaining, depth, isLoading, onLoadMore }: TreeLoadMoreProps) {
	return (
		<div style={getIndentStyle(depth)}>
			<button
				type="button"
				className={cn(
					"flex items-center gap-2 h-8 px-2 text-sm text-muted-foreground",
					"rounded-md hover:bg-accent hover:text-accent-foreground",
					"transition-colors duration-150",
					isLoading && "opacity-50 pointer-events-none"
				)}
				onClick={onLoadMore}
				disabled={isLoading}
			>
				{isLoading ? (
					<>
						<span className="size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
						<span>Loading...</span>
					</>
				) : (
					<span>
						Load more{remaining !== undefined && ` (${remaining} remaining)`}
					</span>
				)}
			</button>
		</div>
	);
}
