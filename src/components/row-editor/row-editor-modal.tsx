import * as React from "react";
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { RowEditorForm } from "./row-editor-form";
import { type RowEditorModalProps } from "./types";
import { useRowForm } from "./use-row-form";

/**
 * Modal component for editing individual rows with form fields
 */
export function RowEditorModal({
	open,
	onOpenChange,
	mode,
	columns,
	initialData,
	tableName,
	onInsert,
	onUpdate,
	onDelete,
}: RowEditorModalProps) {
	const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

	const { fields, errors, isDirty, status, result, setField, submit, deleteRow, reset } = useRowForm({
		columns,
		mode,
		initialData,
		onInsert,
		onUpdate,
		onDelete,
	});

	// Reset form when modal opens/closes or mode changes
	React.useEffect(() => {
		if (open) {
			reset();
		}
	}, [open, reset]);

	// Handle successful operations
	React.useEffect(() => {
		if (result?.success && status === "success") {
			toast.success(result.message);
			onOpenChange(false);
		} else if (result && !result.success && status === "error") {
			toast.error(result.message);
		}
	}, [result, status, onOpenChange]);

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await submit();
	};

	// Handle delete confirmation
	const handleDeleteConfirm = async () => {
		const success = await deleteRow();
		if (success) {
			setShowDeleteConfirm(false);
		}
	};

	// Handle close with unsaved changes warning
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen && isDirty && status !== "success") {
			const confirmed = window.confirm("You have unsaved changes. Are you sure you want to close?");
			if (!confirmed) return;
		}
		onOpenChange(newOpen);
	};

	const isSubmitting = status === "submitting";
	const canDelete = mode === "update" && onDelete;

	// Modal title based on mode
	const getTitle = () => {
		switch (mode) {
			case "insert":
				return `Insert Row`;
			case "update":
				return `Edit Row`;
			case "view":
				return `View Row`;
			default:
				return "Row Editor";
		}
	};

	// Modal description
	const getDescription = () => {
		switch (mode) {
			case "insert":
				return `Add a new row to the ${tableName} table`;
			case "update":
				return `Modify the selected row in the ${tableName} table`;
			case "view":
				return `Viewing row from the ${tableName} table`;
			default:
				return `Managing row in ${tableName}`;
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="max-h-[90vh] md:max-w-2xl overflow-y-auto sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>{getTitle()}</DialogTitle>
						<DialogDescription>{getDescription()}</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSubmit} className="space-y-6">
						<RowEditorForm
							columns={columns}
							fields={fields}
							errors={errors}
							mode={mode}
							disabled={isSubmitting}
							onFieldChange={setField}
						/>

						<DialogFooter className={cn("flex-col gap-2 sm:flex-row", canDelete && "sm:justify-between")}>
							{/* Delete button - only in update mode */}
							{canDelete && (
								<Button
									type="button"
									variant="destructive-outline"
									onClick={() => setShowDeleteConfirm(true)}
									disabled={isSubmitting}
								>
									<Trash2Icon className="size-4" />
									Delete Row
								</Button>
							)}

							<div className="flex flex-col gap-2 sm:flex-row">
								{/* Cancel button */}
								<Button
									type="button"
									variant="outline"
									onClick={() => handleOpenChange(false)}
									disabled={isSubmitting}
								>
									Cancel
								</Button>

								{/* Submit button - not shown in view mode */}
								{mode !== "view" && (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? (
											<>
												<Loader2Icon className="size-4 animate-spin" />
												{mode === "insert" ? "Inserting..." : "Saving..."}
											</>
										) : mode === "insert" ? (
											<>
												<PlusIcon className="size-4" />
												Insert Row
											</>
										) : (
											<>
												<SaveIcon className="size-4" />
												Save Changes
											</>
										)}
									</Button>
								)}
							</div>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation dialog */}
			<DeleteConfirmationDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				onConfirm={handleDeleteConfirm}
				tableName={tableName}
				isDeleting={isSubmitting}
			/>
		</>
	);
}
