import * as React from "react";
import { DatabaseIcon, Loader2Icon, AlertTriangleIcon, UsersIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import type { DatabaseConnection } from "./delete-database-dialog";

export interface RenameDatabaseDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
	/** Current database name */
	databaseName: string;
	/** Callback when rename is confirmed */
	onConfirm: (newName: string, force: boolean) => void;
	/** Whether the rename operation is in progress */
	isRenaming?: boolean;
	/** Whether we're checking for connections */
	isCheckingConnections?: boolean;
	/** Number of active connections to the database */
	activeConnectionCount?: number;
	/** Details about active connections */
	activeConnections?: DatabaseConnection[];
}

/**
 * RenameDatabaseDialog - Dialog for renaming a database
 * Shows an input with the current database name as default value
 * Also displays active connections warning when applicable
 */
export function RenameDatabaseDialog({
	open,
	onOpenChange,
	databaseName,
	onConfirm,
	isRenaming = false,
	isCheckingConnections = false,
	activeConnectionCount = 0,
	activeConnections = [],
}: RenameDatabaseDialogProps) {
	const [newName, setNewName] = React.useState(databaseName);
	const [forceConfirmed, setForceConfirmed] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Reset the name and force confirmation when the dialog opens with a new database
	React.useEffect(() => {
		if (open) {
			setNewName(databaseName);
			setForceConfirmed(false);
			// Focus and select the input text after dialog opens
			setTimeout(() => {
				inputRef.current?.focus();
				inputRef.current?.select();
			}, 50);
		}
	}, [open, databaseName]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = newName.trim();
		if (trimmedName && trimmedName !== databaseName && canRename) {
			onConfirm(trimmedName, hasActiveConnections && forceConfirmed);
		}
	};

	const hasActiveConnections = activeConnectionCount > 0;
	const isValid = newName.trim().length > 0 && newName.trim() !== databaseName;
	const canRename = isValid && (!hasActiveConnections || forceConfirmed);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<DatabaseIcon className="size-5 text-muted-foreground" />
							Rename Database
						</DialogTitle>
						<DialogDescription>
							Enter a new name for the database{" "}
							<span className="font-medium">{databaseName}</span>.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 space-y-4">
						<Input
							ref={inputRef}
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Enter new database name"
							disabled={isRenaming}
							aria-label="New database name"
						/>

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
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isRenaming}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!canRename || isRenaming || isCheckingConnections}
							className={cn(
								hasActiveConnections &&
									forceConfirmed &&
									"bg-amber-600 hover:bg-amber-600/90"
							)}
						>
							{isRenaming ? (
								<>
									<Loader2Icon className="size-4 animate-spin" />
									Renaming...
								</>
							) : hasActiveConnections && forceConfirmed ? (
								<>
									<AlertTriangleIcon className="size-4" />
									Force Rename
								</>
							) : (
								"Rename"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
