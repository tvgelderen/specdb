import * as React from "react";
import { PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { useLocalStorage, useSidebarResize, SIDEBAR_WIDTH } from "~/lib/hooks";
import type { UseSidebarResizeReturn } from "~/lib/hooks";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { SidebarConnectionSelector } from "~/components/sidebar-connection-selector";
import { ExplorerTree } from "./explorer-tree";

/**
 * Props for ExplorerSidebar component
 */
export interface ExplorerSidebarProps {
	/** Optional connection ID for multi-connection support */
	connectionId?: string;
	/** Callback when a node is selected */
	onNodeSelect?: (node: {
		type: "database" | "schema" | "table" | "view" | "materialized_view";
		database?: string;
		schema?: string;
		table?: string;
	}) => void;
	/** Currently selected node ID */
	selectedNodeId?: string;
	/** Optional className for the sidebar container */
	className?: string;
	/** Whether the sidebar is collapsed (desktop) */
	isCollapsed?: boolean;
	/** Whether the mobile sidebar is open */
	isMobileOpen?: boolean;
	/** Callback to toggle collapse state (desktop) */
	onToggleCollapse?: () => void;
	/** Callback to close mobile sidebar */
	onCloseMobile?: () => void;
	/** Optional callback when refresh is clicked */
	onRefresh?: () => void;
	/** Optional callback when create database is clicked */
	onCreateDatabase?: () => void;
	/** Whether there is an active connection */
	hasActiveConnection?: boolean;
	/** Sidebar width in pixels (desktop only) */
	width?: number;
	/** Whether the sidebar is currently being resized */
	isResizing?: boolean;
	/** Props for the resize handle */
	resizeHandleProps?: UseSidebarResizeReturn["resizeHandleProps"];
}

/**
 * ExplorerSidebar - Left sidebar container for the database explorer tree
 * Features collapse/expand, refresh, and resizable width
 */
export function ExplorerSidebar({
	connectionId,
	onNodeSelect,
	selectedNodeId,
	className,
	isCollapsed = false,
	isMobileOpen = false,
	onToggleCollapse,
	onCloseMobile,
	onRefresh,
	onCreateDatabase,
	hasActiveConnection = false,
	width,
	isResizing = false,
	resizeHandleProps,
}: ExplorerSidebarProps) {
	const [isRefreshing, setIsRefreshing] = React.useState(false);

	// Handle refresh with visual feedback
	const handleRefresh = React.useCallback(async () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		try {
			await onRefresh?.();
		} finally {
			// Add a small delay for visual feedback
			setTimeout(() => setIsRefreshing(false), 500);
		}
	}, [isRefreshing, onRefresh]);

	// Calculate style for dynamic width (desktop only, not during mobile overlay)
	const sidebarStyle: React.CSSProperties = width
		? {
				width: `${width}px`,
				minWidth: `${SIDEBAR_WIDTH.MIN}px`,
				maxWidth: `${SIDEBAR_WIDTH.MAX}px`,
			}
		: {};

	return (
		<>
			<aside
				className={cn(
					"flex flex-col border-r bg-sidebar text-sidebar-foreground h-full overflow-hidden",
					// Use fixed width on mobile, dynamic on desktop when width is provided
					!width && "w-72 md:w-64",
					"shrink-0",
					// Only apply transition when not resizing (for smooth collapse/expand)
					!isResizing && "transition-[width] duration-200",
					className
				)}
				style={sidebarStyle}
			>
			{/* Header with Connection Selector */}
			<div className="flex flex-col border-b border-sidebar-border">
				{/* Connection Selector Row */}
				<div className="flex items-center px-2 py-2">
					<div className="flex-1 min-w-0">
						<SidebarConnectionSelector />
					</div>
					<div className="flex items-center gap-0.5 shrink-0">
						{onCreateDatabase && hasActiveConnection && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={onCreateDatabase}
										className="size-7"
										aria-label="Create database"
									>
										<PlusIcon className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Create Database</TooltipContent>
							</Tooltip>
						)}
						{onRefresh && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleRefresh}
										disabled={isRefreshing}
										className="size-7"
										aria-label="Refresh"
									>
										<RefreshCwIcon
											className={cn(
												"size-4",
												isRefreshing && "animate-spin"
											)}
										/>
									</Button>
								</TooltipTrigger>
								<TooltipContent>Refresh</TooltipContent>
							</Tooltip>
						)}
						{/* Mobile: close button */}
						{onCloseMobile && (
							<Button
								variant="ghost"
								size="icon"
								onClick={onCloseMobile}
								className="size-7 md:hidden"
								aria-label="Close sidebar"
							>
								<XIcon className="size-4" />
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Tree container */}
			<ScrollArea className="flex-1 min-h-0" size="sm">
				<ExplorerTree
					connectionId={connectionId}
					onNodeSelect={onNodeSelect}
					selectedNodeId={selectedNodeId}
				/>
			</ScrollArea>

			{/* Footer with connection info (optional) */}
			{connectionId && (
				<div className="px-3 py-2 border-t border-sidebar-border">
					<p className="text-xs text-muted-foreground truncate">
						Connection: {connectionId}
					</p>
				</div>
			)}
		</aside>

			{/* Resize handle - desktop only, invisible but draggable */}
			{resizeHandleProps && (
				<div
					{...resizeHandleProps}
					className={cn(
						// Hidden on mobile, block on desktop
						"hidden md:block",
						// Absolute positioning to overlay the sidebar edge without taking layout space
						"absolute top-0 h-full",
						// Narrow width (8px hit area) - invisible but draggable
						"w-2",
						// Cursor
						"cursor-col-resize",
						// Ensure it's above other content for drag interaction
						"z-10",
						// Focus styles for accessibility
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
					)}
					style={{
						// Position at the right edge of the sidebar, centered on the border
						left: width ? `${width - 4}px` : undefined,
					}}
				/>
			)}
		</>
	);
}

/** localStorage keys for sidebar state persistence */
const SIDEBAR_STORAGE_KEYS = {
	isCollapsed: "explorer-sidebar-collapsed",
	selectedNodeId: "explorer-sidebar-selected-node",
	width: "explorer-sidebar-width",
} as const;

/**
 * useExplorerSidebar - Hook for managing sidebar state
 * Handles both desktop collapse state, mobile overlay state, and resizable width
 * Persists collapse state, selected node, and width to localStorage
 */
export function useExplorerSidebar() {
	// Persist collapse state to localStorage
	const [isCollapsed, setIsCollapsed] = useLocalStorage(SIDEBAR_STORAGE_KEYS.isCollapsed, false);
	// Mobile state is not persisted (should always start closed on fresh load)
	const [isMobileOpen, setIsMobileOpen] = React.useState(false);
	// Persist selected node to localStorage
	const [selectedNodeId, setSelectedNodeId] = useLocalStorage<string | undefined>(
		SIDEBAR_STORAGE_KEYS.selectedNodeId,
		undefined
	);
	// Persist sidebar width to localStorage
	const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>(
		SIDEBAR_STORAGE_KEYS.width,
		SIDEBAR_WIDTH.DEFAULT
	);

	// Sidebar resize functionality
	const {
		width,
		isResizing,
		resizeHandleProps,
		setWidth,
		resetWidth,
	} = useSidebarResize({
		initialWidth: sidebarWidth,
		minWidth: SIDEBAR_WIDTH.MIN,
		maxWidth: SIDEBAR_WIDTH.MAX,
		onWidthChange: setSidebarWidth,
		isCollapsed,
	});

	// Toggle desktop collapse state
	const toggleCollapse = React.useCallback(() => {
		setIsCollapsed((prev) => !prev);
	}, [setIsCollapsed]);

	// Toggle mobile sidebar open/close
	const toggleMobile = React.useCallback(() => {
		setIsMobileOpen((prev) => !prev);
	}, []);

	// Close mobile sidebar
	const closeMobile = React.useCallback(() => {
		setIsMobileOpen(false);
	}, []);

	// Open mobile sidebar
	const openMobile = React.useCallback(() => {
		setIsMobileOpen(true);
	}, []);

	return {
		isCollapsed,
		setIsCollapsed,
		toggleCollapse,
		isMobileOpen,
		setIsMobileOpen,
		toggleMobile,
		closeMobile,
		openMobile,
		selectedNodeId,
		setSelectedNodeId,
		// Resize functionality
		width,
		isResizing,
		resizeHandleProps,
		setWidth,
		resetWidth,
	};
}
