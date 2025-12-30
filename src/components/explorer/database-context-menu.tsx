import * as React from "react";
import { MoreHorizontal, Edit2, Trash } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export interface DatabaseContextMenuProps {
	/** Database name */
	databaseName: string;
	/** Whether the menu is visible (controlled by hover state) */
	isVisible?: boolean;
	/** Callback when rename is clicked */
	onRename: () => void;
	/** Callback when delete is clicked */
	onDelete: () => void;
	/** Additional class names */
	className?: string;
}

/**
 * DatabaseContextMenu - Dropdown menu with rename and delete options for databases
 * Shows a horizontal ellipses icon that appears on hover
 */
export function DatabaseContextMenu({
	databaseName,
	isVisible = true,
	onRename,
	onDelete,
	className,
}: DatabaseContextMenuProps) {
	const [isOpen, setIsOpen] = React.useState(false);

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={cn(
						"size-6 shrink-0 opacity-0 transition-opacity duration-150",
						(isVisible || isOpen) && "opacity-100",
						className,
					)}
					onClick={(e) => {
						e.stopPropagation();
					}}
					aria-label={`Actions for ${databaseName}`}
				>
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
				<DropdownMenuItem
					onClick={(e) => {
						e.stopPropagation();
						onRename();
					}}
				>
					<Edit2 />
					Rename
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className="text-destructive focus:text-destructive [&_svg]:text-destructive!"
				>
					<Trash />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
