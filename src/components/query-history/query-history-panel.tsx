import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { toast } from "sonner";
import {
	SearchIcon,
	RefreshCwIcon,
	ClockIcon,
	CheckCircle2Icon,
	XCircleIcon,
	TrashIcon,
	PlayIcon,
	CopyIcon,
	HistoryIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	XIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

/**
 * Props for the QueryHistoryPanel component
 */
export interface QueryHistoryPanelProps {
	/** Connection ID to filter history by */
	connectionId?: number;
	/** Callback when a query is selected for replay */
	onReplayQuery?: (queryText: string) => void;
	/** Optional className for styling */
	className?: string;
	/** Whether the panel is collapsed */
	isCollapsed?: boolean;
	/** Callback to toggle collapse state */
	onToggleCollapse?: () => void;
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) {
		return "Just now";
	} else if (diffMins < 60) {
		return `${diffMins}m ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		return date.toLocaleDateString();
	}
}

/**
 * Truncate a query string for display
 */
function truncateQuery(query: string, maxLength: number = 100): string {
	const normalized = query.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return normalized.slice(0, maxLength) + "...";
}

/**
 * QueryHistoryPanel - Displays query history with search and replay functionality
 */
export function QueryHistoryPanel({
	connectionId,
	onReplayQuery,
	className,
	isCollapsed = false,
	onToggleCollapse,
}: QueryHistoryPanelProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");
	const [expandedId, setExpandedId] = React.useState<number | null>(null);

	// Debounce search input
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Query history list
	const historyQuery = useQuery(
		trpc.history.list.queryOptions({
			connectionId,
			search: debouncedSearch || undefined,
			limit: 100,
		}),
	);

	// Delete mutation
	const deleteMutation = useMutation(
		trpc.history.delete.mutationOptions({
			onSuccess: () => {
				toast.success("Query deleted from history");
				queryClient.invalidateQueries({ queryKey: trpc.history.list.queryKey() });
			},
			onError: (error) => {
				toast.error(`Failed to delete: ${error.message}`);
			},
		}),
	);

	// Clear all history mutation
	const clearAllMutation = useMutation(
		trpc.history.clearByConnection.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Cleared ${data.deletedCount} queries from history`);
				queryClient.invalidateQueries({ queryKey: trpc.history.list.queryKey() });
			},
			onError: (error) => {
				toast.error(`Failed to clear history: ${error.message}`);
			},
		}),
	);

	// Handle refresh
	const handleRefresh = React.useCallback(() => {
		queryClient.invalidateQueries({ queryKey: trpc.history.list.queryKey() });
	}, [queryClient, trpc.history.list]);

	// Handle copy to clipboard
	const handleCopy = React.useCallback(async (queryText: string) => {
		try {
			await navigator.clipboard.writeText(queryText);
			toast.success("Query copied to clipboard");
		} catch {
			toast.error("Failed to copy query");
		}
	}, []);

	// Handle replay query
	const handleReplay = React.useCallback(
		(queryText: string) => {
			onReplayQuery?.(queryText);
			toast.success("Query loaded in editor");
		},
		[onReplayQuery],
	);

	// Handle toggle expand
	const handleToggleExpand = React.useCallback((id: number) => {
		setExpandedId((prev) => (prev === id ? null : id));
	}, []);

	// Collapsed state
	if (isCollapsed) {
		return (
			<aside
				className={cn("flex flex-col border-l bg-sidebar text-sidebar-foreground", "w-10 shrink-0", className)}
			>
				<div className="flex flex-col items-center py-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={onToggleCollapse}
								className="size-8"
								aria-label="Expand history panel"
							>
								<HistoryIcon className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="left">Query History</TooltipContent>
					</Tooltip>
				</div>
			</aside>
		);
	}

	const entries = historyQuery.data?.entries ?? [];
	const isLoading = historyQuery.isLoading;

	return (
		<aside
			className={cn(
				"flex flex-col border-l bg-sidebar text-sidebar-foreground h-full",
				"w-80 shrink-0",
				className,
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
				<h2 className="text-sm font-semibold text-sidebar-foreground flex items-center gap-2">
					<HistoryIcon className="size-4" />
					Query History
				</h2>
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleRefresh}
								disabled={isLoading}
								className="size-7"
								aria-label="Refresh history"
							>
								<RefreshCwIcon className={cn("size-4", isLoading && "animate-spin")} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Refresh</TooltipContent>
					</Tooltip>

					{/* Clear all button */}
					{connectionId && entries.length > 0 && (
						<AlertDialog>
							<Tooltip>
								<TooltipTrigger asChild>
									<AlertDialogTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="size-7 text-destructive hover:text-destructive"
											aria-label="Clear all history"
										>
											<TrashIcon />
										</Button>
									</AlertDialogTrigger>
								</TooltipTrigger>
								<TooltipContent>Clear History</TooltipContent>
							</Tooltip>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Clear Query History?</AlertDialogTitle>
									<AlertDialogDescription>
										This will permanently delete all query history for this connection. This action
										cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => clearAllMutation.mutate({ connectionId })}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										Clear All
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}

					{/* Collapse button */}
					{onToggleCollapse && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={onToggleCollapse}
									className="size-7"
									aria-label="Collapse history panel"
								>
									<XIcon className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Close</TooltipContent>
						</Tooltip>
					)}
				</div>
			</div>

			{/* Search input */}
			<div className="px-2 py-2 border-b border-sidebar-border">
				<div className="relative">
					<SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						type="search"
						placeholder="Search queries..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-8 pl-8 text-sm bg-sidebar"
						aria-label="Search query history"
					/>
				</div>
			</div>

			{/* History list */}
			<ScrollArea className="flex-1" size="sm">
				<div className="p-2 space-y-1">
					{/* Loading state */}
					{isLoading && (
						<>
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="p-2 rounded-md border bg-card">
									<Skeleton className="h-4 w-3/4 mb-2" />
									<Skeleton className="h-3 w-1/2" />
								</div>
							))}
						</>
					)}

					{/* Empty state */}
					{!isLoading && entries.length === 0 && (
						<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
							<HistoryIcon className="size-10 mb-3 opacity-50" />
							<p className="text-sm font-medium">No queries yet</p>
							<p className="text-xs text-center mt-1">
								{searchQuery ? "No queries match your search" : "Executed queries will appear here"}
							</p>
						</div>
					)}

					{/* History entries */}
					{!isLoading &&
						entries.map((entry) => {
							const isExpanded = expandedId === entry.id;

							return (
								<div
									key={entry.id}
									className={cn(
										"p-2 rounded-md border bg-card transition-colors",
										"hover:bg-accent/50 cursor-pointer",
									)}
									onClick={() => handleToggleExpand(entry.id)}
								>
									{/* Header row */}
									<div className="flex items-start gap-2">
										{/* Status icon */}
										{entry.success ? (
											<CheckCircle2Icon className="size-4 text-success shrink-0 mt-0.5" />
										) : (
											<XCircleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
										)}

										{/* Query preview */}
										<div className="flex-1 min-w-0">
											<p
												className={cn(
													"text-xs font-mono break-all",
													isExpanded ? "whitespace-pre-wrap" : "line-clamp-2",
												)}
											>
												{isExpanded ? entry.queryText : truncateQuery(entry.queryText)}
											</p>

											{/* Metadata row */}
											<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<ClockIcon className="size-3" />
													{formatDate(entry.executedAt)}
												</span>
												{entry.executionTimeMs !== null && (
													<Badge variant="outline" className="text-[10px] px-1 py-0">
														{entry.executionTimeMs}ms
													</Badge>
												)}
												{entry.rowCount !== null && (
													<Badge variant="outline" className="text-[10px] px-1 py-0">
														{entry.rowCount} rows
													</Badge>
												)}
											</div>

											{/* Error message */}
											{!entry.success && entry.errorMessage && isExpanded && (
												<p className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
													{entry.errorMessage}
												</p>
											)}
										</div>

										{/* Expand indicator */}
										<div className="shrink-0">
											{isExpanded ? (
												<ChevronUpIcon className="size-4 text-muted-foreground" />
											) : (
												<ChevronDownIcon className="size-4 text-muted-foreground" />
											)}
										</div>
									</div>

									{/* Action buttons (visible when expanded) */}
									{isExpanded && (
										<div className="flex items-center gap-1 mt-2 pt-2 border-t">
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													handleReplay(entry.queryText);
												}}
												className="h-7 text-xs"
											>
												<PlayIcon className="size-3 mr-1" />
												Run
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													handleCopy(entry.queryText);
												}}
												className="h-7 text-xs"
											>
												<CopyIcon className="size-3 mr-1" />
												Copy
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													deleteMutation.mutate({ id: entry.id });
												}}
												className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
											>
												<TrashIcon className="size-3" />
												Delete
											</Button>
										</div>
									)}
								</div>
							);
						})}
				</div>
			</ScrollArea>

			{/* Footer with stats */}
			{entries.length > 0 && (
				<div className="px-3 py-2 border-t border-sidebar-border">
					<p className="text-xs text-muted-foreground">
						{historyQuery.data?.total ?? entries.length} queries
						{historyQuery.data?.hasMore && " (showing latest 100)"}
					</p>
				</div>
			)}
		</aside>
	);
}

/**
 * Hook for managing query history panel state
 */
export function useQueryHistoryPanel() {
	const [isCollapsed, setIsCollapsed] = React.useState(true);

	const toggleCollapse = React.useCallback(() => {
		setIsCollapsed((prev) => !prev);
	}, []);

	const expand = React.useCallback(() => {
		setIsCollapsed(false);
	}, []);

	const collapse = React.useCallback(() => {
		setIsCollapsed(true);
	}, []);

	return {
		isCollapsed,
		setIsCollapsed,
		toggleCollapse,
		expand,
		collapse,
	};
}
