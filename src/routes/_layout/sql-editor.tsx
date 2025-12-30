import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useConnection } from "~/providers/connection-provider";
import { useSettings } from "~/providers/settings-provider";
import { toast } from "sonner";
import {
	PlayIcon,
	Loader2Icon,
	DatabaseIcon,
	AlertCircleIcon,
	ClockIcon,
	TableIcon,
	HistoryIcon,
} from "lucide-react";
import { DestructiveOperationDialog } from "~/components/sql-editor/destructive-operation-dialog";
import { analyzeDestructiveSql, type DestructiveOperationInfo } from "~/lib/sql";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	DataGrid,
	DataGridTable,
	DataGridPagination,
	DataGridSkeleton,
	type ColumnDef,
	type DataGridState,
} from "~/components/ui/data-grid";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { TimingBadge, type TimingMetrics } from "~/components/ui/timing-badge";
import { QueryHistoryPanel, useQueryHistoryPanel } from "~/components/query-history";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_layout/sql-editor")({
	component: SQLEditorPage,
});

interface QueryResultData {
	rows: Record<string, unknown>[];
	rowCount: number;
	fields: { name: string; dataType: string }[];
}

interface QueryExecutionState {
	data: QueryResultData | null;
	error: string | null;
	executionTimeMs: number | null;
	/** Timing metrics from the server (db roundtrip + total handler time) */
	timing: TimingMetrics | null;
	isLoading: boolean;
}

function SQLEditorPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { activeConnection, connections, setActiveConnection, isLoading: isConnectionLoading } = useConnection();
	const { settings } = useSettings();

	// Query history panel state
	const historyPanel = useQueryHistoryPanel();

	// SQL query state
	const [sql, setSql] = React.useState("SELECT * FROM ");
	const [queryState, setQueryState] = React.useState<QueryExecutionState>({
		data: null,
		error: null,
		executionTimeMs: null,
		timing: null,
		isLoading: false,
	});

	// Destructive operation warning dialog state
	const [destructiveDialogOpen, setDestructiveDialogOpen] = React.useState(false);
	const [pendingDestructiveOperations, setPendingDestructiveOperations] = React.useState<DestructiveOperationInfo[]>([]);

	// Grid state for pagination
	const [gridState, setGridState] = React.useState<DataGridState>({
		page: 1,
		pageSize: 25,
		sortColumn: null,
		sortDirection: null,
		filterColumn: null,
		filterValue: "",
	});

	// Get active connection credentials for query execution
	const credentialsQuery = useQuery(trpc.connections.getActiveCredentials.queryOptions());

	// Execute query mutation
	const executeQueryMutation = useMutation(
		trpc.postgres.executeQuery.mutationOptions({
			onSuccess: (data, variables, context) => {
				// Success handled in execute function
			},
			onError: (error) => {
				setQueryState((prev) => ({
					...prev,
					error: error.message,
					isLoading: false,
				}));
				toast.error(`Query failed: ${error.message}`);
			},
		})
	);

	// Save to history mutation
	const saveHistoryMutation = useMutation(
		trpc.history.create.mutationOptions({
			onSuccess: () => {
				// Invalidate history queries to refresh the list
				queryClient.invalidateQueries({ queryKey: trpc.history.list.queryKey() });
			},
		})
	);

	// Internal function to perform the actual query execution
	const performQueryExecution = React.useCallback(async () => {
		if (!credentialsQuery.data?.config || !activeConnection) {
			return;
		}

		setQueryState({
			data: null,
			error: null,
			executionTimeMs: null,
			timing: null,
			isLoading: true,
		});

		// Reset pagination on new query
		setGridState((prev) => ({ ...prev, page: 1 }));

		const startTime = performance.now();
		const queryText = sql.trim();

		try {
			const config = credentialsQuery.data.config as {
				host: string;
				port: number;
				user: string;
				password: string;
				database: string;
				ssl?: boolean | { rejectUnauthorized: boolean };
			};

			const result = await executeQueryMutation.mutateAsync({
				host: config.host,
				port: config.port,
				user: config.user,
				password: config.password,
				database: config.database,
				ssl: config.ssl,
				sql: queryText,
			});

			const executionTimeMs = Math.round(performance.now() - startTime);

			// Extract timing metrics from response if available
			const serverTiming = (result as { timing?: TimingMetrics }).timing;

			setQueryState({
				data: result as QueryResultData,
				error: null,
				executionTimeMs,
				timing: serverTiming ?? null,
				isLoading: false,
			});

			// Save successful query to history
			saveHistoryMutation.mutate({
				connectionId: activeConnection.id,
				queryText,
				executionTimeMs,
				rowCount: result.rowCount,
				success: true,
			});

			toast.success(`Query executed in ${executionTimeMs}ms - ${result.rowCount} rows returned`);
		} catch (error) {
			const executionTimeMs = Math.round(performance.now() - startTime);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";

			setQueryState({
				data: null,
				error: errorMessage,
				executionTimeMs,
				timing: null,
				isLoading: false,
			});

			// Save failed query to history
			saveHistoryMutation.mutate({
				connectionId: activeConnection.id,
				queryText,
				executionTimeMs,
				success: false,
				errorMessage,
			});
		}
	}, [sql, credentialsQuery.data, activeConnection, executeQueryMutation, saveHistoryMutation]);

	// Execute query function - checks for destructive operations first
	const executeQuery = React.useCallback(async () => {
		if (!sql.trim()) {
			toast.error("Please enter a SQL query");
			return;
		}

		if (!credentialsQuery.data?.config) {
			toast.error("No active connection. Please select a connection first.");
			return;
		}

		if (!activeConnection) {
			toast.error("No active connection available.");
			return;
		}

		// Check for destructive operations if warnings are enabled
		if (settings.warnOnDestructiveQueries) {
			const analysis = analyzeDestructiveSql(sql.trim());
			if (analysis.hasDestructiveOperations) {
				setPendingDestructiveOperations(analysis.operations);
				setDestructiveDialogOpen(true);
				return;
			}
		}

		// No destructive operations or warnings disabled, execute directly
		await performQueryExecution();
	}, [sql, credentialsQuery.data, activeConnection, settings.warnOnDestructiveQueries, performQueryExecution]);

	// Handle confirmed destructive operation execution
	const handleConfirmDestructiveOperation = React.useCallback(async () => {
		setDestructiveDialogOpen(false);
		setPendingDestructiveOperations([]);
		await performQueryExecution();
	}, [performQueryExecution]);

	// Handle replay query from history
	const handleReplayQuery = React.useCallback((queryText: string) => {
		setSql(queryText);
	}, []);

	// Keyboard shortcut handler (Ctrl+Enter / Cmd+Enter)
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				if (!queryState.isLoading) {
					executeQuery();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [executeQuery, queryState.isLoading]);

	// Handle connection selection
	const handleConnectionChange = async (connectionId: string) => {
		const id = parseInt(connectionId, 10);
		if (!isNaN(id)) {
			await setActiveConnection(id);
		}
	};

	// Generate column definitions from query result
	const columns = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
		if (!queryState.data?.fields) return [];

		return queryState.data.fields.map((field) => ({
			id: field.name,
			header: field.name,
			accessorKey: field.name,
			sortable: true,
			filterable: true,
			cell: (value) => {
				if (value === null) {
					return <span className="text-muted-foreground italic">NULL</span>;
				}
				if (typeof value === "object") {
					return (
						<span className="font-mono text-xs">
							{JSON.stringify(value)}
						</span>
					);
				}
				return String(value);
			},
		}));
	}, [queryState.data?.fields]);

	return (
		<div className="flex h-full">
			{/* Main content area */}
			<div className="flex flex-col gap-4 flex-1 min-w-0 h-full">
				{/* Header with Connection Selector */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<h1 className="text-2xl font-semibold flex items-center gap-2">
						<DatabaseIcon className="size-6" />
						SQL Editor
					</h1>

					{/* Connection Selector and History Toggle */}
					<div className="flex items-center gap-2 w-full sm:w-auto">
						<span className="text-sm text-muted-foreground whitespace-nowrap">
							Connection:
						</span>
						<Select
							value={activeConnection?.id.toString() ?? ""}
							onValueChange={handleConnectionChange}
							disabled={isConnectionLoading}
						>
							<SelectTrigger className="w-full sm:w-[220px]">
								<SelectValue placeholder="Select a connection" />
							</SelectTrigger>
							<SelectContent>
								{connections.length === 0 ? (
									<SelectItem value="none" disabled>
										No connections available
									</SelectItem>
								) : (
									connections.map((conn) => (
										<SelectItem key={conn.id} value={conn.id.toString()}>
											<span className="flex items-center gap-2">
												{conn.color && (
													<span
														className="size-2 rounded-full"
														style={{ backgroundColor: conn.color }}
													/>
												)}
												{conn.name}
												<span className="text-muted-foreground text-xs">
													({conn.database})
												</span>
											</span>
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>

						{/* History panel toggle button */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={historyPanel.isCollapsed ? "outline" : "secondary"}
									size="icon"
									onClick={historyPanel.toggleCollapse}
									className="shrink-0"
									aria-label={historyPanel.isCollapsed ? "Show query history" : "Hide query history"}
								>
									<HistoryIcon className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{historyPanel.isCollapsed ? "Show History" : "Hide History"}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

			{/* Query Editor Card */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-lg">Query</CardTitle>
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground hidden sm:inline">
								Press Ctrl+Enter to run
							</span>
							<Button
								onClick={executeQuery}
								disabled={queryState.isLoading || !activeConnection}
								size="sm"
							>
								{queryState.isLoading ? (
									<>
										<Loader2Icon className="size-4 mr-2 animate-spin" />
										Running...
									</>
								) : (
									<>
										<PlayIcon className="size-4 mr-2" />
										Run Query
									</>
								)}
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<SQLTextarea
						value={sql}
						onChange={setSql}
						disabled={queryState.isLoading}
						placeholder="Enter your SQL query here..."
					/>
				</CardContent>
			</Card>

			{/* Results Section */}
			<Card className="flex-1 flex flex-col min-h-0">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-lg flex items-center gap-2">
							<TableIcon className="size-5" />
							Results
						</CardTitle>
						{/* Show timing badge if server timing is available, fallback to simple display */}
						{queryState.timing ? (
							<TimingBadge
								timing={queryState.timing}
								rowCount={queryState.data?.rowCount}
							/>
						) : queryState.executionTimeMs !== null ? (
							<div className="flex items-center gap-4 text-sm text-muted-foreground">
								<span className="flex items-center gap-1">
									<ClockIcon className="size-4" />
									{queryState.executionTimeMs}ms
								</span>
								{queryState.data && (
									<span>
										{queryState.data.rowCount} row{queryState.data.rowCount !== 1 ? "s" : ""}
									</span>
								)}
							</div>
						) : null}
					</div>
				</CardHeader>
				<CardContent className="flex-1 flex flex-col min-h-0">
					{/* Error State */}
					{queryState.error && (
						<div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
							<AlertCircleIcon className="size-5 mt-0.5 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="font-medium">Query Error</p>
								<p className="text-sm mt-1 whitespace-pre-wrap break-words">
									{queryState.error}
								</p>
							</div>
						</div>
					)}

					{/* Loading State */}
					{queryState.isLoading && (
						<DataGridSkeleton columns={5} rows={10} />
					)}

					{/* Results Grid */}
					{queryState.data && !queryState.isLoading && queryState.data.rows.length > 0 && (
						<DataGrid
							data={queryState.data.rows}
							columns={columns}
							totalRows={queryState.data.rowCount}
							state={gridState}
							onStateChange={setGridState}
							className="flex-1"
						>
							<DataGridTable />
							<DataGridPagination />
						</DataGrid>
					)}

					{/* Empty Results */}
					{queryState.data && !queryState.isLoading && queryState.data.rows.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<TableIcon className="size-12 mb-4 opacity-50" />
							<p className="text-lg font-medium">No rows returned</p>
							<p className="text-sm">
								The query executed successfully but returned no data.
							</p>
						</div>
					)}

					{/* Initial State */}
					{!queryState.data && !queryState.error && !queryState.isLoading && (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<DatabaseIcon className="size-12 mb-4 opacity-50" />
							<p className="text-lg font-medium">
								{activeConnection
									? "Ready to execute queries"
									: "Select a connection to get started"}
							</p>
							<p className="text-sm">
								{activeConnection
									? "Write your SQL query above and click Run or press Ctrl+Enter"
									: "Choose a database connection from the dropdown above"}
							</p>
						</div>
					)}
				</CardContent>
			</Card>
			</div>

			{/* Query History Panel */}
			{!historyPanel.isCollapsed && (
				<QueryHistoryPanel
					connectionId={activeConnection?.id}
					onReplayQuery={handleReplayQuery}
					isCollapsed={false}
					onToggleCollapse={historyPanel.toggleCollapse}
				/>
			)}

			{/* Destructive Operation Warning Dialog */}
			<DestructiveOperationDialog
				open={destructiveDialogOpen}
				onOpenChange={setDestructiveDialogOpen}
				onConfirm={handleConfirmDestructiveOperation}
				operations={pendingDestructiveOperations}
				isExecuting={queryState.isLoading}
			/>
		</div>
	);
}

// SQL Textarea Component with syntax highlighting keywords
interface SQLTextareaProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

function SQLTextarea({ value, onChange, disabled, placeholder }: SQLTextareaProps) {
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const highlightRef = React.useRef<HTMLDivElement>(null);

	// SQL keywords for highlighting
	const SQL_KEYWORDS = [
		"SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL",
		"INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
		"CREATE", "TABLE", "ALTER", "DROP", "INDEX", "VIEW",
		"JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "ON",
		"GROUP", "BY", "ORDER", "ASC", "DESC", "HAVING",
		"LIMIT", "OFFSET", "AS", "DISTINCT", "ALL", "UNION", "INTERSECT", "EXCEPT",
		"CASE", "WHEN", "THEN", "ELSE", "END",
		"COUNT", "SUM", "AVG", "MIN", "MAX",
		"LIKE", "ILIKE", "BETWEEN", "EXISTS",
		"PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE", "CHECK", "DEFAULT",
		"CONSTRAINT", "CASCADE", "TRUNCATE", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION",
		"TRUE", "FALSE", "RETURNING", "WITH", "RECURSIVE", "COALESCE", "NULLIF"
	];

	// Highlight SQL syntax
	const highlightSql = React.useCallback((text: string): string => {
		if (!text) return "";

		let highlighted = text
			// Escape HTML
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		// Highlight strings (single quotes)
		highlighted = highlighted.replace(
			/'([^'\\]|\\.)*'/g,
			'<span class="text-success">$&</span>'
		);

		// Highlight numbers
		highlighted = highlighted.replace(
			/\b(\d+(\.\d+)?)\b/g,
			'<span class="text-info">$1</span>'
		);

		// Highlight keywords (case-insensitive)
		const keywordPattern = new RegExp(
			`\\b(${SQL_KEYWORDS.join("|")})\\b`,
			"gi"
		);
		highlighted = highlighted.replace(
			keywordPattern,
			'<span class="text-primary font-semibold">$1</span>'
		);

		// Highlight comments
		highlighted = highlighted.replace(
			/--.*$/gm,
			'<span class="text-muted-foreground italic">$&</span>'
		);

		return highlighted;
	}, []);

	// Sync scroll positions
	const handleScroll = React.useCallback(() => {
		if (textareaRef.current && highlightRef.current) {
			highlightRef.current.scrollTop = textareaRef.current.scrollTop;
			highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
		}
	}, []);

	return (
		<div className="relative">
			{/* Highlight Layer */}
			<div
				ref={highlightRef}
				className={cn(
					"absolute inset-0 pointer-events-none overflow-auto",
					"font-mono text-sm whitespace-pre-wrap break-words",
					"p-3 border border-transparent rounded-md"
				)}
				aria-hidden="true"
				dangerouslySetInnerHTML={{ __html: highlightSql(value) + "\n" }}
			/>

			{/* Actual Textarea */}
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onScroll={handleScroll}
				disabled={disabled}
				placeholder={placeholder}
				spellCheck={false}
				className={cn(
					"relative w-full min-h-[200px] max-h-[400px] resize-y",
					"font-mono text-sm text-transparent caret-foreground",
					"p-3 border rounded-md bg-background",
					"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
					"disabled:opacity-50 disabled:cursor-not-allowed",
					"placeholder:text-muted-foreground"
				)}
				style={{
					WebkitTextFillColor: "transparent",
					caretColor: "var(--foreground)",
				}}
			/>
		</div>
	);
}
