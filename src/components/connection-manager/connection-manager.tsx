import * as React from "react";
import { useState, useCallback } from "react";
import { Database, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { ScrollArea } from "~/components/ui/scroll-area";
import { ConnectionCard } from "./connection-card";
import { ConnectionForm, type ConnectionFormFields, type ConnectionTestResult } from "~/components/connection-form";
import { useConnection, type Connection } from "~/providers/connection-provider";
import { useTRPC } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface ConnectionManagerProps {
	className?: string;
}

export function ConnectionManager({ className }: ConnectionManagerProps) {
	const trpc = useTRPC();
	const {
		connections,
		activeConnection,
		isLoading,
		setActiveConnection,
		clearActiveConnection,
		deleteConnection,
		testConnection,
		refetchConnections,
		isOperationPending,
	} = useConnection();

	// Local state
	const [searchQuery, setSearchQuery] = useState("");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
	const [deletingConnection, setDeletingConnection] = useState<Connection | null>(null);
	const [connectingId, setConnectingId] = useState<number | null>(null);
	const [testingId, setTestingId] = useState<number | null>(null);
	const [testResults, setTestResults] = useState<Record<number, { success: boolean; latencyMs: number }>>({});

	// Create connection mutation
	const createMutation = useMutation(
		trpc.connections.create.mutationOptions({
			onSuccess: () => {
				toast.success("Connection created successfully");
				setShowCreateDialog(false);
				refetchConnections();
			},
			onError: (error) => {
				toast.error(`Failed to create connection: ${error.message}`);
			},
		}),
	);

	// Update connection mutation
	const updateMutation = useMutation(
		trpc.connections.update.mutationOptions({
			onSuccess: () => {
				toast.success("Connection updated successfully");
				setEditingConnection(null);
				refetchConnections();
			},
			onError: (error) => {
				toast.error(`Failed to update connection: ${error.message}`);
			},
		}),
	);

	// Test connection mutation (for forms)
	const testFormMutation = useMutation(trpc.connections.test.mutationOptions());

	// Filter connections by search query
	const filteredConnections = React.useMemo(() => {
		if (!searchQuery.trim()) {
			return connections;
		}
		const query = searchQuery.toLowerCase();
		return connections.filter(
			(conn) =>
				conn.name.toLowerCase().includes(query) ||
				(conn.host?.toLowerCase().includes(query) ?? false) ||
				(conn.database?.toLowerCase().includes(query) ?? false) ||
				conn.providerType.toLowerCase().includes(query) ||
				(conn.sqliteConfig?.filepath?.toLowerCase().includes(query) ?? false),
		);
	}, [connections, searchQuery]);

	// Handlers
	const handleConnect = useCallback(
		async (id: number) => {
			setConnectingId(id);
			try {
				await setActiveConnection(id);
			} finally {
				setConnectingId(null);
			}
		},
		[setActiveConnection],
	);

	const handleDisconnect = useCallback(async () => {
		await clearActiveConnection();
	}, [clearActiveConnection]);

	const handleTest = useCallback(
		async (id: number) => {
			setTestingId(id);
			try {
				const result = await testConnection(id);
				setTestResults((prev) => ({
					...prev,
					[id]: { success: result.success, latencyMs: result.latencyMs },
				}));
				if (result.success) {
					toast.success(`Connection successful (${result.latencyMs}ms)`);
				} else {
					toast.error(`Connection failed: ${result.message}`);
				}
			} catch (error) {
				toast.error("Failed to test connection");
			} finally {
				setTestingId(null);
			}
		},
		[testConnection],
	);

	const handleDelete = useCallback(async () => {
		if (!deletingConnection) return;
		try {
			await deleteConnection(deletingConnection.id);
			setDeletingConnection(null);
		} catch (error) {
			// Error is handled by the mutation
		}
	}, [deletingConnection, deleteConnection]);

	const handleTestConnection = async (fields: ConnectionFormFields): Promise<ConnectionTestResult> => {
		return await testFormMutation.mutateAsync({
			providerType: fields.providerType,
			host: fields.host,
			port: fields.port,
			database: fields.database,
			username: fields.username,
			password: fields.password,
			sslConfig: fields.sslConfig,
			connectionTimeoutMs: fields.connectionTimeoutMs,
			sqliteConfig: fields.sqliteConfig,
		});
	};

	const handleCreateSubmit = (data: ConnectionFormFields) => {
		createMutation.mutate({
			name: data.name,
			providerType: data.providerType,
			host: data.host,
			port: data.port,
			database: data.database,
			username: data.username,
			password: data.password,
			sslConfig: data.sslConfig,
			maxPoolSize: data.maxPoolSize,
			idleTimeoutMs: data.idleTimeoutMs,
			connectionTimeoutMs: data.connectionTimeoutMs,
			sqliteConfig: data.sqliteConfig,
			color: data.color,
			notes: data.notes,
		});
	};

	const handleEditSubmit = (data: ConnectionFormFields) => {
		if (!editingConnection) return;
		updateMutation.mutate({
			id: editingConnection.id,
			name: data.name,
			providerType: data.providerType,
			host: data.host,
			port: data.port,
			database: data.database,
			username: data.username,
			password: data.password || undefined, // Only send if provided
			sslConfig: data.sslConfig,
			maxPoolSize: data.maxPoolSize,
			idleTimeoutMs: data.idleTimeoutMs,
			connectionTimeoutMs: data.connectionTimeoutMs,
			sqliteConfig: data.sqliteConfig,
			color: data.color,
			notes: data.notes,
		});
	};

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center py-12", className)}>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">Connections</h1>
					<p className="text-muted-foreground">Manage your database connections</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="icon" onClick={refetchConnections} disabled={isOperationPending}>
						<RefreshCw className={cn("size-4", isOperationPending && "animate-spin")} />
					</Button>
					<Button onClick={() => setShowCreateDialog(true)} className="gap-2">
						<Plus className="size-4" />
						New Connection
					</Button>
				</div>
			</div>

			{/* Search bar */}
			{connections.length > 0 && (
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						placeholder="Search connections..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>
			)}

			{/* Connections list */}
			{connections.length === 0 ? (
				<Card>
					<CardContent className="py-0">
						<Empty className="py-12">
							<EmptyMedia variant="icon">
								<Database />
							</EmptyMedia>
							<EmptyHeader>
								<EmptyTitle>No connections yet</EmptyTitle>
								<EmptyDescription>
									Create your first database connection to get started exploring your data.
								</EmptyDescription>
							</EmptyHeader>
							<Button onClick={() => setShowCreateDialog(true)} className="gap-2">
								<Plus className="size-4" />
								Add Connection
							</Button>
						</Empty>
					</CardContent>
				</Card>
			) : filteredConnections.length === 0 ? (
				<Card>
					<CardContent className="py-0">
						<Empty className="py-12">
							<EmptyMedia variant="icon">
								<Search />
							</EmptyMedia>
							<EmptyHeader>
								<EmptyTitle>No matches found</EmptyTitle>
								<EmptyDescription>
									No connections match your search query. Try a different search term.
								</EmptyDescription>
							</EmptyHeader>
							<Button variant="outline" onClick={() => setSearchQuery("")}>
								Clear Search
							</Button>
						</Empty>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-3">
					{filteredConnections.map((connection) => (
						<ConnectionCard
							key={connection.id}
							connection={connection}
							isActive={activeConnection?.id === connection.id}
							onConnect={() => handleConnect(connection.id)}
							onDisconnect={handleDisconnect}
							onEdit={() => setEditingConnection(connection)}
							onDelete={() => setDeletingConnection(connection)}
							onTest={() => handleTest(connection.id)}
							isConnecting={connectingId === connection.id}
							isTesting={testingId === connection.id}
							testResult={testResults[connection.id] || null}
						/>
					))}
				</div>
			)}

			{/* Create Connection Dialog */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent className="md:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden pb-8">
					<DialogHeader>
						<DialogTitle>New Connection</DialogTitle>
						<DialogDescription>
							Add a new database connection. You can enter credentials manually or paste a connection
							string.
						</DialogDescription>
					</DialogHeader>
					<ConnectionForm
						onSubmit={handleCreateSubmit}
						onTest={handleTestConnection}
						submitLabel="Create Connection"
						isSaving={createMutation.isPending}
						showCancel
						onCancel={() => setShowCreateDialog(false)}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit Connection Dialog */}
			<Dialog open={!!editingConnection} onOpenChange={(open) => !open && setEditingConnection(null)}>
				<DialogContent className="md:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden pb-8">
					<DialogHeader>
						<DialogTitle>Edit Connection</DialogTitle>
						<DialogDescription>
							Update the connection settings. Leave password blank to keep the existing password.
						</DialogDescription>
					</DialogHeader>
					{editingConnection && (
						<ConnectionForm
							initialValues={{
								name: editingConnection.name,
								providerType: editingConnection.providerType as
									| "postgres"
									| "mysql"
									| "sqlite"
									| "mongodb"
									| "redis",
								host: editingConnection.host ?? "",
								port: editingConnection.port ?? 0,
								database: editingConnection.database ?? "",
								username: editingConnection.username ?? "",
								password: "", // Don't prefill password
								sslConfig: editingConnection.sslConfig || { enabled: false },
								maxPoolSize: editingConnection.maxPoolSize || 10,
								idleTimeoutMs: editingConnection.idleTimeoutMs || 30000,
								connectionTimeoutMs: editingConnection.connectionTimeoutMs || 5000,
								sqliteConfig: editingConnection.sqliteConfig || {
									filepath: "",
									readonly: false,
									fileMustExist: true,
									enableWAL: true,
									enableForeignKeys: true,
								},
								color: editingConnection.color,
								notes: editingConnection.notes,
							}}
							onSubmit={handleEditSubmit}
							onTest={handleTestConnection}
							submitLabel="Save Changes"
							isSaving={updateMutation.isPending}
							showCancel
							onCancel={() => setEditingConnection(null)}
							isEditing
						/>
					)}
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deletingConnection} onOpenChange={(open) => !open && setDeletingConnection(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Connection</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{deletingConnection?.name}"? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
