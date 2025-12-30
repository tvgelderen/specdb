import { createFileRoute } from "@tanstack/react-router";
import { SettingsIcon, ShieldAlertIcon, RotateCcwIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "~/providers/settings-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/_layout/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const { settings, updateSetting, resetToDefaults, isOperationPending, isLoading } = useSettings();

	const handleToggleDestructiveWarnings = async (checked: boolean) => {
		try {
			await updateSetting("warnOnDestructiveQueries", checked);
			toast.success(
				checked
					? "Destructive query warnings enabled"
					: "Destructive query warnings disabled"
			);
		} catch (error) {
			toast.error("Failed to update setting");
		}
	};

	const handleResetToDefaults = async () => {
		try {
			await resetToDefaults();
			toast.success("Settings reset to defaults");
		} catch (error) {
			toast.error("Failed to reset settings");
		}
	};

	if (isLoading) {
		return (
			<section className="flex flex-col gap-6 w-full mx-auto max-w-3xl p-4">
				<div className="flex items-center gap-2">
					<SettingsIcon className="size-6" />
					<h1 className="text-2xl font-semibold">Settings</h1>
				</div>
				<Card>
					<CardContent className="flex items-center justify-center py-8">
						<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
					</CardContent>
				</Card>
			</section>
		);
	}

	return (
		<section className="flex flex-col gap-6 w-full mx-auto max-w-3xl p-4">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<SettingsIcon className="size-6" />
					<h1 className="text-2xl font-semibold">Settings</h1>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={handleResetToDefaults}
					disabled={isOperationPending}
				>
					{isOperationPending ? (
						<Loader2Icon className="size-4 mr-2 animate-spin" />
					) : (
						<RotateCcwIcon className="size-4 mr-2" />
					)}
					Reset to Defaults
				</Button>
			</div>

			{/* SQL Editor Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldAlertIcon className="size-5" />
						SQL Editor Safety
					</CardTitle>
					<CardDescription>
						Configure safety features for the SQL editor to prevent accidental data loss.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Destructive Query Warnings */}
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<Label
								htmlFor="warn-destructive-queries"
								className="text-base font-medium cursor-pointer"
							>
								Warn on destructive queries
							</Label>
							<p className="text-sm text-muted-foreground">
								Show a confirmation dialog before executing queries that can permanently
								modify or delete data. This includes:
							</p>
							<ul className="text-sm text-muted-foreground list-disc list-inside ml-2 mt-2 space-y-1">
								<li>DROP DATABASE, TABLE, SCHEMA, INDEX, or VIEW</li>
								<li>TRUNCATE TABLE</li>
								<li>DELETE without WHERE clause</li>
								<li>ALTER TABLE DROP COLUMN/CONSTRAINT</li>
							</ul>
						</div>
						<Switch
							id="warn-destructive-queries"
							checked={settings.warnOnDestructiveQueries}
							onCheckedChange={handleToggleDestructiveWarnings}
							disabled={isOperationPending}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Additional Settings Cards can be added here in the future */}
		</section>
	);
}
