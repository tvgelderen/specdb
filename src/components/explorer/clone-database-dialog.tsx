import * as React from "react";
import { CopyIcon, Loader2Icon, AlertTriangleIcon, UsersIcon } from "lucide-react";
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

export interface CloneDatabaseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sourceDatabaseName: string;
	onConfirm: (targetName: string, force: boolean) => void;
	isCloning?: boolean;
	isCheckingConnections?: boolean;
	activeConnectionCount?: number;
	activeConnections?: DatabaseConnection[];
}

export function CloneDatabaseDialog({
	open,
	onOpenChange,
	sourceDatabaseName,
	onConfirm,
	isCloning = false,
	isCheckingConnections = false,
	activeConnectionCount = 0,
	activeConnections = [],
}: CloneDatabaseDialogProps) {
	const [targetName, setTargetName] = React.useState(`${sourceDatabaseName}_copy`);
	const [forceConfirmed, setForceConfirmed] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (open) {
			setTargetName(`${sourceDatabaseName}_copy`);
			setForceConfirmed(false);
			setTimeout(() => {
				inputRef.current?.focus();
				inputRef.current?.select();
			}, 50);
		}
	}, [open, sourceDatabaseName]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = targetName.trim();
		if (trimmedName && trimmedName !== sourceDatabaseName && canClone) {
			onConfirm(trimmedName, hasActiveConnections && forceConfirmed);
		}
	};

	const hasActiveConnections = activeConnectionCount > 0;
	const isValid = targetName.trim().length > 0 && targetName.trim() !== sourceDatabaseName;
	const canClone = isValid && (!hasActiveConnections || forceConfirmed);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CopyIcon className="size-5 text-muted-foreground" />
							Clone Database
						</DialogTitle>
						<DialogDescription>
							Create a copy of the database{" "}
							<span className="font-medium">{sourceDatabaseName}</span>.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 space-y-4">
						<Input
							ref={inputRef}
							value={targetName}
							onChange={(e) => setTargetName(e.target.value)}
							placeholder="Enter new database name"
							disabled={isCloning}
							aria-label="New database name"
						/>

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
										{activeConnectionCount !== 1 ? "s" : ""} on source database
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
							disabled={isCloning}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!canClone || isCloning || isCheckingConnections}
							className={cn(
								hasActiveConnections &&
									forceConfirmed &&
									"bg-amber-600 hover:bg-amber-600/90"
							)}
						>
							{isCloning ? (
								<>
									<Loader2Icon className="size-4 animate-spin" />
									Cloning...
								</>
							) : hasActiveConnections && forceConfirmed ? (
								<>
									<AlertTriangleIcon className="size-4" />
									Force Clone
								</>
							) : (
								<>
									<CopyIcon className="size-4" />
									Clone
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
