import { Loader2Icon, AlertTriangleIcon } from "lucide-react";
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

interface DeleteRowsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rowCount: number;
	onConfirm: () => Promise<void>;
	isDeleting?: boolean;
}

export function DeleteRowsDialog({
	open,
	onOpenChange,
	rowCount,
	onConfirm,
	isDeleting = false,
}: DeleteRowsDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangleIcon className="size-5 text-destructive" />
						Delete {rowCount} row{rowCount !== 1 ? "s" : ""}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. The selected row{rowCount !== 1 ? "s" : ""} will be permanently
						deleted from the database.
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
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isDeleting ? (
							<>
								<Loader2Icon className="size-4 animate-spin" />
								Deleting...
							</>
						) : (
							"Delete"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
