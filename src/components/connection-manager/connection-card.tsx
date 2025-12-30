import { CheckCircle2, Circle, Database, Edit2, Loader2, MoreVertical, Play, Trash, Unplug, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { Connection } from "~/providers/connection-provider";

interface ConnectionCardProps {
	connection: Connection;
	isActive: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onTest: () => void;
	isConnecting?: boolean;
	isTesting?: boolean;
	testResult?: { success: boolean; latencyMs: number } | null;
}

const providerLabels: Record<string, string> = {
	postgres: "PostgreSQL",
	mysql: "MySQL",
	sqlite: "SQLite",
	mongodb: "MongoDB",
	redis: "Redis",
};

export function ConnectionCard({
	connection,
	isActive,
	onConnect,
	onDisconnect,
	onEdit,
	onDelete,
	onTest,
	isConnecting = false,
	isTesting = false,
	testResult = null,
}: ConnectionCardProps) {
	return (
		<Card
			className={cn(
				"transition-all duration-200 hover:shadow-md",
				isActive && "border-success ring-2 ring-success/20 shadow-sm",
			)}
		>
			<CardContent className="flex items-center gap-4 p-4">
				{/* Selection indicator */}
				<button
					type="button"
					onClick={isActive ? onDisconnect : onConnect}
					disabled={isConnecting}
					className={cn(
						"flex-shrink-0 rounded-full p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						isActive ? "text-success hover:text-success/80" : "text-muted-foreground hover:text-foreground",
					)}
				>
					{isConnecting ? (
						<Loader2 className="size-5 animate-spin" />
					) : isActive ? (
						<CheckCircle2 className="size-5" />
					) : (
						<Circle className="size-5" />
					)}
				</button>

				{/* Color indicator */}
				<div
					className="size-3 rounded-full flex-shrink-0"
					style={{ backgroundColor: connection.color || "#6B7280" }}
				/>

				{/* Connection info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-medium truncate">{connection.name}</h3>
						{isActive && (
							<Badge variant="default" className="bg-success text-white text-xs">
								Active
							</Badge>
						)}
						<Badge variant="outline" className="text-xs">
							{providerLabels[connection.providerType] || connection.providerType}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground truncate mt-0.5">
						{connection.host}:{connection.port}/{connection.database}
					</p>
					{testResult && (
						<p className={cn("text-xs mt-1", testResult.success ? "text-success" : "text-destructive")}>
							{testResult.success ? `Connected (${testResult.latencyMs}ms)` : "Connection failed"}
						</p>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1 flex-shrink-0">
					{/* Quick connect/disconnect button */}
					{!isActive && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={onConnect} disabled={isConnecting}>
									{isConnecting ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Play className="size-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Connect</TooltipContent>
						</Tooltip>
					)}

					{isActive && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={onDisconnect} disabled={isConnecting}>
									<Unplug className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Disconnect</TooltipContent>
						</Tooltip>
					)}

					{/* Test connection button */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" onClick={onTest} disabled={isTesting}>
								{isTesting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Test Connection</TooltipContent>
					</Tooltip>

					{/* More actions dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<MoreVertical className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onEdit}>
								<Edit2 className="size-4 mr-2" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onTest} disabled={isTesting}>
								<Zap className="size-4 mr-2" />
								Test Connection
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
								<Trash />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardContent>
		</Card>
	);
}
