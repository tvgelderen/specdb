import { AlertTriangleIcon, Loader2Icon, TrashIcon } from "lucide-react";
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
import { type DeleteConfirmationDialogProps } from "./types";

/**
 * Confirmation dialog for destructive delete operations
 */
export function DeleteConfirmationDialog({
	open,
	onOpenChange,
	onConfirm,
	tableName,
	isDeleting = false,
}: DeleteConfirmationDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangleIcon className="size-5 text-destructive" />
						Delete Row
					</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete this row from the{" "}
						<span className="font-medium">{tableName}</span> table? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={(e) => {
							e.preventDefault();
							onConfirm();
						}}
						disabled={isDeleting}
						className="bg-destructive text-white hover:bg-destructive/90"
					>
						{isDeleting ? (
							<>
								<Loader2Icon className="size-4 animate-spin" />
								Deleting...
							</>
						) : (
							<>
								<TrashIcon />
								Delete Row
							</>
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
