import * as React from "react";
import {
	AlertTriangleIcon,
	Loader2Icon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
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
import { Checkbox } from "~/components/ui/checkbox";

export interface DatabaseConnection {
	pid: number;
	username: string;
	applicationName: string | null;
	clientAddr: string | null;
	state: string | null;
}

export interface DeleteDatabaseDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
	/** Database name to delete */
	databaseName: string;
	/** Callback when delete is confirmed */
	onConfirm: (force: boolean) => void;
	/** Whether the delete operation is in progress */
	isDeleting?: boolean;
	/** Whether we're checking for connections */
	isCheckingConnections?: boolean;
	/** Number of active connections to the database */
	activeConnectionCount?: number;
	/** Details about active connections */
	activeConnections?: DatabaseConnection[];
}

/**
 * DeleteDatabaseDialog - Alert dialog for confirming database deletion
 * Shows a warning about the destructive action and active connections
 */
export function DeleteDatabaseDialog({
	open,
	onOpenChange,
	databaseName,
	onConfirm,
	isDeleting = false,
	isCheckingConnections = false,
	activeConnectionCount = 0,
	activeConnections = [],
}: DeleteDatabaseDialogProps) {
	const [forceConfirmed, setForceConfirmed] = React.useState(false);

	// Reset force confirmation when dialog closes or database changes
	React.useEffect(() => {
		if (!open) {
			setForceConfirmed(false);
		}
	}, [open]);

	const hasActiveConnections = activeConnectionCount > 0;
	const canDelete = !hasActiveConnections || forceConfirmed;

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangleIcon className="size-5 text-destructive" />
						Delete Database
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3">
							<p>
								Are you sure you want to delete the database{" "}
								<span className="font-medium">{databaseName}</span>? This action
								cannot be undone and will permanently remove all data, tables,
								and schemas within this database.
							</p>

							{/* Connection warning */}
							{isCheckingConnections && (
								<div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
									<Loader2Icon className="size-4 animate-spin" />
									<span>Checking for active connections...</span>
								</div>
							)}

							{!isCheckingConnections && hasActiveConnections && (
								<div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md space-y-2">
									<div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-medium">
										<UsersIcon className="size-4" />
										<span>
											{activeConnectionCount} active connection
											{activeConnectionCount !== 1 ? "s" : ""} detected
										</span>
									</div>

									{activeConnections.length > 0 && (
										<div className="text-sm text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
											{activeConnections.slice(0, 5).map((conn) => (
												<div key={conn.pid} className="flex items-center gap-2">
													<span className="font-mono text-xs bg-muted px-1 rounded">
														PID {conn.pid}
													</span>
													<span>{conn.username}</span>
													{conn.applicationName && (
														<span className="text-xs text-muted-foreground">
															({conn.applicationName})
														</span>
													)}
												</div>
											))}
											{activeConnections.length > 5 && (
												<div className="text-xs text-muted-foreground">
													...and {activeConnections.length - 5} more
												</div>
											)}
										</div>
									)}

									<label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-amber-500/20">
										<Checkbox
											checked={forceConfirmed}
											onCheckedChange={(checked) =>
												setForceConfirmed(checked === true)
											}
											className="mt-0.5"
										/>
										<span className="text-sm">
											I understand that these connections will be terminated and
											want to proceed anyway
										</span>
									</label>
								</div>
							)}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={(e) => {
							e.preventDefault();
							onConfirm(hasActiveConnections && forceConfirmed);
						}}
						disabled={isDeleting || isCheckingConnections || !canDelete}
						className="bg-destructive text-white hover:bg-destructive/90"
					>
						{isDeleting ? (
							<>
								<Loader2Icon className="size-4 animate-spin" />
								Deleting...
							</>
						) : hasActiveConnections && forceConfirmed ? (
							<>
								<AlertTriangleIcon className="size-4" />
								Force Delete
							</>
						) : (
							<>
								<TrashIcon className="size-4" />
								Delete Database
							</>
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
