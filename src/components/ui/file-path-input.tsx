import * as React from "react";
import {
	FolderOpen,
	Database,
	X,
	ChevronRight,
	Home,
	ArrowUp,
	RefreshCw,
	Loader2,
	FolderPlus,
	Check,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { useTRPC } from "~/trpc/react";

export interface FilePathInputProps {
	/** Current file path value */
	value: string;
	/** Called when the value changes */
	onChange: (value: string) => void;
	/** Placeholder text */
	placeholder?: string;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** File extension filter (e.g., ".db", ".sqlite") */
	extensions?: string[];
	/** Label for the input */
	label?: string;
	/** Error message */
	error?: string;
	/** Hint text */
	hint?: string;
	/** Additional class name */
	className?: string;
	/** Whether to show the browse button */
	showBrowseButton?: boolean;
}

interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	isFile: boolean;
	size: number;
	modifiedAt: string;
	extension: string | null;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date to relative or short format
 */
function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	return date.toLocaleDateString();
}

interface FileBrowserDialogProps {
	value: string;
	onChange: (value: string) => void;
	extensions?: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function FileBrowserDialog({
	value,
	onChange,
	extensions = [".db", ".sqlite", ".sqlite3"],
	open,
	onOpenChange,
}: FileBrowserDialogProps) {
	const [currentPath, setCurrentPath] = React.useState("~");
	const [selectedPath, setSelectedPath] = React.useState(value);
	const [newFileName, setNewFileName] = React.useState("");
	const [showNewFileInput, setShowNewFileInput] = React.useState(false);

	const trpc = useTRPC();

	// Fetch directory contents
	const {
		data: directoryData,
		isLoading,
		error,
		refetch,
	} = useQuery({
		...trpc.filesystem.listDirectory.queryOptions({ path: currentPath, extensions, showHidden: false }),
		enabled: open,
	});

	// Fetch quick access paths
	const { data: quickAccessPaths } = useQuery({
		...trpc.filesystem.getQuickAccessPaths.queryOptions(),
		enabled: open,
	});

	// Initialize path when dialog opens
	React.useEffect(() => {
		if (open) {
			setSelectedPath(value);
			// If value has a directory, start there
			if (value) {
				const lastSlash = value.lastIndexOf("/");
				if (lastSlash > 0) {
					setCurrentPath(value.substring(0, lastSlash));
				}
			}
		}
	}, [open, value]);

	const handleNavigate = (path: string) => {
		setCurrentPath(path);
		setShowNewFileInput(false);
	};

	const handleSelectFile = (entry: FileEntry) => {
		if (entry.isDirectory) {
			handleNavigate(entry.path);
		} else {
			setSelectedPath(entry.path);
		}
	};

	const handleGoUp = () => {
		if (directoryData?.parentPath) {
			handleNavigate(directoryData.parentPath);
		}
	};

	const handleGoHome = () => {
		handleNavigate("~");
	};

	const handleConfirm = () => {
		onChange(selectedPath);
		onOpenChange(false);
	};

	const handleCreateNewFile = () => {
		if (newFileName.trim()) {
			let fileName = newFileName.trim();
			// Add .db extension if not present
			if (!fileName.includes(".")) {
				fileName += ".db";
			}
			const fullPath =
				directoryData?.currentPath === "/" ? `/${fileName}` : `${directoryData?.currentPath}/${fileName}`;
			setSelectedPath(fullPath);
			setShowNewFileInput(false);
			setNewFileName("");
		}
	};

	// Build breadcrumb parts
	const breadcrumbParts = React.useMemo(() => {
		if (!directoryData?.currentPath) return [];
		const path = directoryData.currentPath;
		const parts = path.split("/").filter(Boolean);
		const result: { name: string; path: string }[] = [];

		let currentBreadcrumb = "";
		for (const part of parts) {
			currentBreadcrumb += `/${part}`;
			result.push({ name: part, path: currentBreadcrumb });
		}
		return result;
	}, [directoryData?.currentPath]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="md:max-w-3xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Database className="size-5" />
						Select SQLite Database
					</DialogTitle>
					<DialogDescription>Browse files or enter a path for a new database</DialogDescription>
				</DialogHeader>

				<div className="flex flex-1 gap-4 min-h-0">
					{/* Sidebar - Quick Access */}
					<div className="w-40 shrink-0 space-y-1">
						<p className="text-xs font-medium text-muted-foreground px-2 py-1">Quick Access</p>
						{quickAccessPaths?.map((item) => (
							<button
								key={item.path}
								type="button"
								onClick={() => handleNavigate(item.path)}
								className={cn(
									"flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent text-left",
									directoryData?.currentPath === item.path && "bg-accent",
								)}
							>
								{item.icon === "home" ? (
									<Home className="size-4 text-muted-foreground shrink-0" />
								) : (
									<FolderOpen className="size-4 text-muted-foreground shrink-0" />
								)}
								<span className="truncate">{item.name}</span>
							</button>
						))}
					</div>

					<Separator orientation="vertical" />

					{/* Main file browser */}
					<div className="flex-1 flex flex-col min-w-0">
						{/* Toolbar */}
						<div className="flex items-center gap-2 mb-3">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8"
								onClick={handleGoUp}
								disabled={!directoryData?.parentPath}
							>
								<ArrowUp className="size-4" />
							</Button>
							<Button type="button" variant="ghost" size="icon" className="size-8" onClick={handleGoHome}>
								<Home className="size-4" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8"
								onClick={() => refetch()}
								disabled={isLoading}
							>
								<RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
							</Button>

							{/* Breadcrumb */}
							<div className="flex-1 flex items-center gap-1 text-sm overflow-x-auto">
								<button
									type="button"
									onClick={() => handleNavigate("/")}
									className="hover:text-foreground text-muted-foreground shrink-0"
								>
									/
								</button>
								{breadcrumbParts.map((part, index) => (
									<React.Fragment key={part.path}>
										<ChevronRight className="size-3 text-muted-foreground shrink-0" />
										<button
											type="button"
											onClick={() => handleNavigate(part.path)}
											className={cn(
												"hover:text-foreground truncate max-w-32",
												index === breadcrumbParts.length - 1
													? "text-foreground font-medium"
													: "text-muted-foreground",
											)}
										>
											{part.name}
										</button>
									</React.Fragment>
								))}
							</div>

							<Button
								type="button"
								variant="outline"
								size="sm"
								className="gap-1 shrink-0"
								onClick={() => setShowNewFileInput(true)}
							>
								<FolderPlus className="size-4" />
								<span className="hidden sm:inline">New</span>
							</Button>
						</div>

						{/* New file input */}
						{showNewFileInput && (
							<div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
								<Database className="size-4 text-muted-foreground" />
								<Input
									value={newFileName}
									onChange={(e) => setNewFileName(e.target.value)}
									placeholder="new-database.db"
									className="flex-1 h-8 text-sm"
									autoFocus
									onKeyDown={(e) => {
										if (e.key === "Enter") handleCreateNewFile();
										if (e.key === "Escape") {
											setShowNewFileInput(false);
											setNewFileName("");
										}
									}}
								/>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={handleCreateNewFile}
									disabled={!newFileName.trim()}
								>
									<Check className="size-4" />
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => {
										setShowNewFileInput(false);
										setNewFileName("");
									}}
								>
									<X className="size-4" />
								</Button>
							</div>
						)}

						{/* File list */}
						<ScrollArea className="border rounded-md max-h-[60vh]">
							{isLoading ? (
								<div className="flex items-center justify-center h-48">
									<Loader2 className="size-6 animate-spin text-muted-foreground" />
								</div>
							) : error || directoryData?.error ? (
								<div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
									<p className="text-sm">Error loading directory</p>
									<p className="text-xs">{directoryData?.error || error?.message}</p>
								</div>
							) : directoryData?.entries.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
									<FolderOpen className="size-8 mb-2 opacity-50" />
									<p className="text-sm">No database files found</p>
									<p className="text-xs">Click "New" to create a database here</p>
								</div>
							) : (
								<div className="divide-y">
									{directoryData?.entries.map((entry) => (
										<button
											key={entry.path}
											type="button"
											onClick={() => handleSelectFile(entry)}
											onDoubleClick={() => {
												if (!entry.isDirectory) {
													setSelectedPath(entry.path);
													handleConfirm();
												}
											}}
											className={cn(
												"flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent transition-colors",
												selectedPath === entry.path && "bg-accent",
											)}
										>
											{entry.isDirectory ? (
												<FolderOpen className="size-5 text-blue-500 shrink-0" />
											) : (
												<Database className="size-5 text-emerald-500 shrink-0" />
											)}
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">{entry.name}</p>
												{entry.isFile && (
													<p className="text-xs text-muted-foreground">
														{formatBytes(entry.size)} &bull; {formatDate(entry.modifiedAt)}
													</p>
												)}
											</div>
											{!entry.isDirectory && (
												<ChevronRight className="size-4 text-muted-foreground shrink-0" />
											)}
										</button>
									))}
								</div>
							)}
						</ScrollArea>

						{/* Selected path display */}
						<div className="mt-3 space-y-2">
							<Label className="text-xs font-medium text-muted-foreground">Selected Path</Label>
							<Input
								value={selectedPath}
								onChange={(e) => setSelectedPath(e.target.value)}
								placeholder="Enter path or select a file above"
								className="font-mono text-sm"
							/>
						</div>
					</div>
				</div>

				<DialogFooter className="mt-4">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button type="button" onClick={handleConfirm} disabled={!selectedPath.trim()}>
						Select
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * File path input component with browse dialog
 * Designed for selecting SQLite database files
 */
export function FilePathInput({
	value,
	onChange,
	placeholder = "Enter file path or browse...",
	disabled = false,
	extensions = [".db", ".sqlite", ".sqlite3"],
	label,
	error,
	hint,
	className,
	showBrowseButton = true,
}: FilePathInputProps) {
	const [dialogOpen, setDialogOpen] = React.useState(false);

	return (
		<div className={cn("space-y-2", className)}>
			{label && <Label className={cn(error && "text-destructive")}>{label}</Label>}

			<div className="flex gap-2">
				<div className="relative flex-1">
					<Database className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={placeholder}
						disabled={disabled}
						className={cn("pl-10 pr-8 font-mono text-sm", error && "border-destructive")}
						aria-invalid={!!error}
					/>
					{value && !disabled && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
							onClick={() => onChange("")}
						>
							<X className="size-4 text-muted-foreground" />
							<span className="sr-only">Clear</span>
						</Button>
					)}
				</div>

				{showBrowseButton && (
					<>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDialogOpen(true)}
							disabled={disabled}
							className="gap-2 shrink-0"
						>
							<FolderOpen className="size-4" />
							<span className="hidden sm:inline">Browse</span>
						</Button>

						<FileBrowserDialog
							value={value}
							onChange={onChange}
							extensions={extensions}
							open={dialogOpen}
							onOpenChange={setDialogOpen}
						/>
					</>
				)}
			</div>

			{hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
