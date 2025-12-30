import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Database, ChevronDown, Loader2, Unplug, Plus, Circle, Settings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useConnection } from "~/providers/connection-provider";
import { cn } from "~/lib/utils";

const providerLabels: Record<string, string> = {
	postgres: "PostgreSQL",
	mysql: "MySQL",
	sqlite: "SQLite",
	mongodb: "MongoDB",
	redis: "Redis",
};

const providerShortLabels: Record<string, string> = {
	postgres: "PG",
	mysql: "MySQL",
	sqlite: "SQLite",
	mongodb: "Mongo",
	redis: "Redis",
};

/**
 * SidebarConnectionSelector - A larger connection selector designed for the sidebar
 * Replaces the "Explorer" header text and provides full connection switching functionality
 */
export function SidebarConnectionSelector() {
	const {
		connections,
		activeConnection,
		isLoading,
		setActiveConnection,
		clearActiveConnection,
		isOperationPending,
	} = useConnection();

	const [isOpen, setIsOpen] = React.useState(false);
	const [connectingId, setConnectingId] = React.useState<number | null>(null);

	const handleConnect = async (id: number) => {
		setConnectingId(id);
		try {
			await setActiveConnection(id);
			setIsOpen(false);
		} finally {
			setConnectingId(null);
		}
	};

	const handleDisconnect = async () => {
		await clearActiveConnection();
		setIsOpen(false);
	};

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 px-1 py-1">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
				<span className="text-sm text-muted-foreground">Loading...</span>
			</div>
		);
	}

	if (connections.length === 0) {
		return (
			<Button
				variant="ghost"
				size="sm"
				asChild
				className="h-9 gap-2 px-2 w-full justify-start hover:bg-sidebar-accent"
			>
				<Link to="/connections">
					<Database className="size-4 text-muted-foreground" />
					<span className="text-sm text-muted-foreground">Add connection</span>
				</Link>
			</Button>
		);
	}

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"h-9 gap-2 px-2 w-full justify-start hover:bg-sidebar-accent",
						"max-w-full overflow-hidden"
					)}
				>
					{activeConnection ? (
						<>
							<span className="relative flex size-2.5 shrink-0">
								<span
									className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
									style={{ backgroundColor: activeConnection.color || "#22C55E" }}
								/>
								<span
									className="relative inline-flex rounded-full size-2.5"
									style={{ backgroundColor: activeConnection.color || "#22C55E" }}
								/>
							</span>
							<span className="truncate text-sm font-medium">
								{activeConnection.name}
							</span>
							<Badge
								variant="secondary"
								className="text-[10px] px-1.5 py-0 h-4 font-medium shrink-0"
							>
								{providerShortLabels[activeConnection.providerType] || activeConnection.providerType}
							</Badge>
						</>
					) : (
						<>
							<Circle className="size-2.5 text-muted-foreground fill-muted-foreground/30 shrink-0" />
							<span className="text-sm text-muted-foreground">
								Not connected
							</span>
						</>
					)}
					<ChevronDown className="size-3.5 text-muted-foreground shrink-0 ml-auto" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72" sideOffset={8}>
				<DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
					Database Connections
				</DropdownMenuLabel>
				<DropdownMenuSeparator />

				<div className="max-h-[280px] overflow-y-auto">
					{connections.map((connection) => {
						const isActive = activeConnection?.id === connection.id;
						const isConnecting = connectingId === connection.id;

						return (
							<DropdownMenuItem
								key={connection.id}
								onClick={() => !isActive && handleConnect(connection.id)}
								disabled={isConnecting}
								className={cn(
									"flex items-center gap-3 cursor-pointer py-2.5 px-3",
									isActive && "bg-accent"
								)}
							>
								<div className="relative flex-shrink-0">
									<div
										className="size-8 rounded-md flex items-center justify-center"
										style={{ backgroundColor: `${connection.color || "#6B7280"}15` }}
									>
										<Database
											className="size-4"
											style={{ color: connection.color || "#6B7280" }}
										/>
									</div>
									{isActive && (
										<span
											className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-popover"
											style={{ backgroundColor: connection.color || "#22C55E" }}
										/>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">{connection.name}</p>
									<p className="text-xs text-muted-foreground truncate">
										{providerLabels[connection.providerType] || connection.providerType}
										{connection.host && ` · ${connection.host}`}
									</p>
								</div>
								{isConnecting && (
									<Loader2 className="size-4 animate-spin flex-shrink-0 text-muted-foreground" />
								)}
								{isActive && !isConnecting && (
									<Badge
										variant="secondary"
										className="text-[10px] px-1.5 py-0 h-4 font-medium flex-shrink-0 bg-success/10 text-success border-0"
									>
										Active
									</Badge>
								)}
							</DropdownMenuItem>
						);
					})}
				</div>

				{activeConnection && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={handleDisconnect}
							disabled={isOperationPending}
							className="text-destructive focus:text-destructive focus:bg-destructive/10 py-2"
						>
							<Unplug className="size-4 mr-2" />
							<span className="text-sm">Disconnect</span>
						</DropdownMenuItem>
					</>
				)}

				<DropdownMenuSeparator />
				<DropdownMenuItem asChild className="py-2">
					<Link to="/connections" className="flex items-center gap-2">
						<Settings className="size-4" />
						<span className="text-sm">Manage Connections</span>
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
