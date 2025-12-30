import * as React from "react";
import { DatabaseIcon, Loader2Icon } from "lucide-react";
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
import { Label } from "~/components/ui/label";

export interface CreateDatabaseDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
	/** Callback when creation is confirmed */
	onConfirm: (databaseName: string) => void;
	/** Whether the create operation is in progress */
	isCreating?: boolean;
}

/**
 * CreateDatabaseDialog - Dialog for creating a new database
 * Shows an input field for the database name
 */
export function CreateDatabaseDialog({
	open,
	onOpenChange,
	onConfirm,
	isCreating = false,
}: CreateDatabaseDialogProps) {
	const [databaseName, setDatabaseName] = React.useState("");
	const [validationError, setValidationError] = React.useState<string | null>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Reset the form when the dialog opens
	React.useEffect(() => {
		if (open) {
			setDatabaseName("");
			setValidationError(null);
			// Focus the input after dialog opens
			setTimeout(() => {
				inputRef.current?.focus();
			}, 50);
		}
	}, [open]);

	// Validate database name
	const validateDatabaseName = (name: string): string | null => {
		if (!name.trim()) {
			return null; // Don't show error for empty input
		}
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
			return "Database name must start with a letter or underscore and contain only alphanumeric characters and underscores";
		}
		const reserved = ["postgres", "template0", "template1"];
		if (reserved.includes(name.toLowerCase())) {
			return "Cannot use reserved database name";
		}
		return null;
	};

	const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setDatabaseName(value);
		setValidationError(validateDatabaseName(value));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = databaseName.trim();
		const error = validateDatabaseName(trimmedName);
		if (error) {
			setValidationError(error);
			return;
		}
		if (trimmedName) {
			onConfirm(trimmedName);
		}
	};

	const isValid = databaseName.trim().length > 0 && !validationError;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<DatabaseIcon className="size-5 text-muted-foreground" />
							Create Database
						</DialogTitle>
						<DialogDescription>
							Enter a name for the new database. Database names must start with a
							letter or underscore and contain only alphanumeric characters and
							underscores.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 space-y-2">
						<Label htmlFor="database-name">Database Name</Label>
						<Input
							id="database-name"
							ref={inputRef}
							value={databaseName}
							onChange={handleNameChange}
							placeholder="my_new_database"
							disabled={isCreating}
							aria-label="Database name"
							aria-describedby={validationError ? "database-name-error" : undefined}
							aria-invalid={!!validationError}
						/>
						{validationError && (
							<p
								id="database-name-error"
								className="text-sm text-destructive"
								role="alert"
							>
								{validationError}
							</p>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isCreating}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!isValid || isCreating}>
							{isCreating ? (
								<>
									<Loader2Icon className="size-4 animate-spin" />
									Creating...
								</>
							) : (
								"Create"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
