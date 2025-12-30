import * as React from "react";
import { ClockIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * Timing metrics data
 */
export interface TimingMetrics {
	/** Total handler duration in milliseconds (client-perceived latency) */
	totalMs: number;
	/** Database roundtrip time in milliseconds */
	dbMs: number;
}

/**
 * Props for TimingBadge component
 */
export interface TimingBadgeProps extends React.ComponentProps<"div"> {
	/** Timing metrics to display */
	timing: TimingMetrics;
	/** Number of rows returned (optional) */
	rowCount?: number;
	/** Whether to show the clock icon */
	showIcon?: boolean;
	/** Badge variant */
	variant?: "default" | "secondary" | "outline";
}

/**
 * Format milliseconds for display
 */
function formatMs(ms: number): string {
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(2)}s`;
	}
	return `${Math.round(ms)}ms`;
}

/**
 * TimingBadge - Displays timing metrics in a compact badge format
 *
 * Shows timing information in the format: "Xms total - Yms db - N rows"
 * with optional hover details showing a breakdown.
 *
 * @example
 * ```tsx
 * <TimingBadge
 *   timing={{ totalMs: 150, dbMs: 45 }}
 *   rowCount={1234}
 * />
 * ```
 */
export function TimingBadge({
	timing,
	rowCount,
	showIcon = true,
	variant = "secondary",
	className,
	...props
}: TimingBadgeProps) {
	const overheadMs = timing.totalMs - timing.dbMs;
	const dbPercent = timing.totalMs > 0 ? Math.round((timing.dbMs / timing.totalMs) * 100) : 0;

	// Build the compact display string
	const parts: string[] = [
		`${formatMs(timing.totalMs)} total`,
		`${formatMs(timing.dbMs)} db`,
	];
	if (rowCount !== undefined) {
		parts.push(`${formatNumber(rowCount)} rows`);
	}
	const displayText = parts.join(" \u2022 ");

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className={cn("inline-flex", className)} {...props}>
					<Badge
						variant={variant}
						className="gap-1.5 cursor-help font-normal"
					>
						{showIcon && <ClockIcon className="size-3" />}
						<span>{displayText}</span>
					</Badge>
				</div>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">
				<div className="space-y-1.5 text-xs">
					<div className="font-medium text-sm">Query Timing Breakdown</div>
					<div className="grid grid-cols-2 gap-x-3 gap-y-1">
						<span className="text-muted-foreground">Total time:</span>
						<span className="font-mono">{formatMs(timing.totalMs)}</span>
						<span className="text-muted-foreground">Database:</span>
						<span className="font-mono">{formatMs(timing.dbMs)} ({dbPercent}%)</span>
						<span className="text-muted-foreground">Overhead:</span>
						<span className="font-mono">{formatMs(overheadMs)} ({100 - dbPercent}%)</span>
						{rowCount !== undefined && (
							<>
								<span className="text-muted-foreground">Rows:</span>
								<span className="font-mono">{formatNumber(rowCount)}</span>
							</>
						)}
					</div>
					<div className="text-muted-foreground pt-1 border-t border-border/50">
						Total = Handler duration (client-perceived)
						<br />
						DB = Database roundtrip time
						<br />
						Overhead = Serialization, network, etc.
					</div>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Compact variant for inline usage
 */
export function TimingBadgeCompact({
	timing,
	rowCount,
	className,
	...props
}: Omit<TimingBadgeProps, "showIcon" | "variant">) {
	return (
		<TimingBadge
			timing={timing}
			rowCount={rowCount}
			showIcon={false}
			variant="outline"
			className={className}
			{...props}
		/>
	);
}

/**
 * Format a number with thousands separators
 */
function formatNumber(num: number): string {
	return new Intl.NumberFormat().format(num);
}
