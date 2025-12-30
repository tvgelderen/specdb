import { AlertTriangleIcon, ShieldAlertIcon, Loader2Icon } from "lucide-react";
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
import {
	type DestructiveOperationInfo,
	getDestructiveOperationMessage,
} from "~/lib/sql";

export interface DestructiveOperationDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when the dialog open state changes */
	onOpenChange: (open: boolean) => void;
	/** Callback when the user confirms the operation */
	onConfirm: () => void;
	/** List of detected destructive operations */
	operations: DestructiveOperationInfo[];
	/** Whether the operation is currently executing */
	isExecuting?: boolean;
}

/**
 * Confirmation dialog for destructive SQL operations
 * Shows a warning with details about the detected operations
 */
export function DestructiveOperationDialog({
	open,
	onOpenChange,
	onConfirm,
	operations,
	isExecuting = false,
}: DestructiveOperationDialogProps) {
	const hasCriticalOperation = operations.some((op) => op.severity === "critical");

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-lg">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						{hasCriticalOperation ? (
							<ShieldAlertIcon className="size-5 text-destructive" />
						) : (
							<AlertTriangleIcon className="size-5 text-warning" />
						)}
						{hasCriticalOperation
							? "Critical Destructive Operation"
							: "Destructive Operation Detected"}
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3">
							<p>
								Your query contains {operations.length > 1 ? "operations" : "an operation"} that
								will permanently modify or delete data:
							</p>

							<ul className="space-y-2">
								{operations.map((op, index) => (
									<li
										key={index}
										className="flex flex-col gap-1 rounded-md bg-muted p-2"
									>
										<div className="flex items-center gap-2">
											{op.severity === "critical" ? (
												<ShieldAlertIcon className="size-4 text-destructive flex-shrink-0" />
											) : (
												<AlertTriangleIcon className="size-4 text-warning flex-shrink-0" />
											)}
											<span className="font-medium text-foreground">
												{op.description}
											</span>
										</div>
										<p className="text-xs text-muted-foreground pl-6">
											{getDestructiveOperationMessage(op.type)}
										</p>
									</li>
								))}
							</ul>

							<p className="text-sm font-medium text-destructive">
								This action cannot be undone. Are you sure you want to proceed?
							</p>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={(e) => {
							e.preventDefault();
							onConfirm();
						}}
						disabled={isExecuting}
						className="bg-destructive text-white hover:bg-destructive/90"
					>
						{isExecuting ? (
							<>
								<Loader2Icon className="size-4 animate-spin" />
								Executing...
							</>
						) : (
							<>
								<AlertTriangleIcon className="size-4" />
								Execute Anyway
							</>
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
