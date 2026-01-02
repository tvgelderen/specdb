import * as React from "react";
import {
	Database,
	Server,
	Lock,
	User,
	Key,
	Settings2,
	RefreshCw,
	CheckCircle2,
	XCircle,
	Loader2,
	Eye,
	EyeOff,
	LinkIcon,
	ArrowRightLeft,
	FileText,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { FilePathInput } from "~/components/ui/file-path-input";
import { cn, formatErrorMessage } from "~/lib/utils";
import { useConnectionForm } from "./use-connection-form";
import {
	type ConnectionFormFields,
	type InputMode,
	type ConnectionTestResult,
	providerTypes,
	defaultPorts,
	enabledProviders,
	type ProviderType,
} from "./types";

interface ConnectionFormProps {
	/** Initial form values */
	initialValues?: Partial<ConnectionFormFields>;
	/** Initial input mode */
	initialMode?: InputMode;
	/** Called when form is submitted */
	onSubmit?: (data: ConnectionFormFields) => void;
	/** Called to test connection */
	onTest?: (data: ConnectionFormFields) => Promise<ConnectionTestResult>;
	/** Submit button text */
	submitLabel?: string;
	/** Whether the form is in a loading/saving state */
	isSaving?: boolean;
	/** Whether to show the cancel button */
	showCancel?: boolean;
	/** Called when cancel is clicked */
	onCancel?: () => void;
	/** Whether this is editing an existing connection */
	isEditing?: boolean;
	/** Additional class name */
	className?: string;
}

/**
 * Provider type display names and icons
 */
const providerConfig: Record<ProviderType, { label: string; icon: React.ReactNode; description: string }> = {
	postgres: {
		label: "PostgreSQL",
		icon: <Database className="size-4" />,
		description: "Powerful, open source object-relational database",
	},
	mysql: {
		label: "MySQL",
		icon: <Database className="size-4" />,
		description: "Popular open-source relational database",
	},
	sqlite: { label: "SQLite", icon: <FileText className="size-4" />, description: "Lightweight file-based database" },
	mongodb: {
		label: "MongoDB",
		icon: <Database className="size-4" />,
		description: "Document-oriented NoSQL database",
	},
	redis: { label: "Redis", icon: <Database className="size-4" />, description: "In-memory data structure store" },
};

/**
 * Field group component for organizing form fields
 */
function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

/**
 * Field wrapper with label and error handling
 */
function FormField({
	label,
	error,
	required,
	children,
	className,
	hint,
}: {
	label: string;
	error?: string;
	required?: boolean;
	children: React.ReactNode;
	className?: string;
	hint?: string;
}) {
	return (
		<div className={cn("space-y-2", className)}>
			<Label className={cn(required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>{label}</Label>
			{children}
			{hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}

/**
 * Connection test feedback component
 */
function ConnectionTestFeedback({
	status,
	result,
}: {
	status: "idle" | "testing" | "success" | "error";
	result: ConnectionTestResult | null;
}) {
	if (status === "idle") return null;

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border p-4 transition-colors",
				status === "testing" && "border-muted-foreground/25 bg-muted/50",
				status === "success" && "border-success/25 bg-success/5 text-success",
				status === "error" && "border-destructive/25 bg-destructive/5 text-destructive",
			)}
		>
			{status === "testing" && (
				<>
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
					<div className="flex-1">
						<p className="font-medium text-foreground">Testing connection...</p>
						<p className="text-sm text-muted-foreground">This may take a few seconds</p>
					</div>
				</>
			)}
			{status === "success" && result && (
				<>
					<CheckCircle2 className="size-5" />
					<div className="flex-1">
						<p className="font-medium">Connection successful</p>
						<p className="text-sm opacity-80">Latency: {result.latencyMs}ms</p>
					</div>
				</>
			)}
			{status === "error" && result && (
				<>
					<XCircle className="size-5" />
					<div className="flex-1">
						<p className="font-medium">Connection failed</p>
						<p className="text-sm opacity-80">{formatErrorMessage(result.message)}</p>
					</div>
				</>
			)}
		</div>
	);
}

export function ConnectionForm({
	initialValues,
	initialMode = "fields",
	onSubmit,
	onTest,
	submitLabel = "Save Connection",
	isSaving = false,
	showCancel = false,
	onCancel,
	isEditing = false,
	className,
}: ConnectionFormProps) {
	const [showPassword, setShowPassword] = React.useState(false);

	const form = useConnectionForm({
		initialValues,
		initialMode,
		onTest,
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!form.validate()) {
			return;
		}

		onSubmit?.(form.getFormData());
	};

	const handleModeChange = (newMode: string) => {
		const mode = newMode as InputMode;

		// Sync data when switching modes
		if (mode === "connectionString" && form.mode === "fields") {
			form.syncToConnectionString();
		} else if (mode === "fields" && form.mode === "connectionString") {
			form.syncFromConnectionString();
		}

		form.setMode(mode);
	};

	return (
		<form onSubmit={handleSubmit} className={cn("space-y-6 overflow-x-hidden", className)}>
			{/* Connection Name */}
			<FormField label="Connection Name" error={form.errors.name} required>
				<Input
					value={form.fields.name}
					onChange={(e) => form.setField("name", e.target.value)}
					placeholder="My Database Connection"
					aria-invalid={!!form.errors.name}
				/>
			</FormField>

			{/* Input Mode Tabs */}
			{/* SQLite doesn't use connection strings, so we hide the tabs */}
			{form.fields.providerType === "sqlite" ? (
				<div className="space-y-6">
					{/* SQLite-specific fields */}
					{/* File Path */}
					<FilePathInput
						value={form.fields.sqliteConfig.filepath}
						onChange={(value) =>
							form.setField("sqliteConfig", {
								...form.fields.sqliteConfig,
								filepath: value,
							})
						}
						label="Database File"
						error={form.errors.sqliteConfig as string | undefined}
						hint="Path to the SQLite database file (.db, .sqlite, .sqlite3)"
						placeholder="/path/to/database.db"
					/>

					{/* SQLite Options */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="sqlite-readonly-main" className="font-normal flex items-center gap-2">
									<Lock className="size-4 text-muted-foreground" />
									Read-only mode
								</Label>
								<p className="text-xs text-muted-foreground">Open database in read-only mode</p>
							</div>
							<Switch
								id="sqlite-readonly-main"
								checked={form.fields.sqliteConfig.readonly}
								onCheckedChange={(checked) =>
									form.setField("sqliteConfig", {
										...form.fields.sqliteConfig,
										readonly: checked === true,
									})
								}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="sqlite-must-exist-main" className="font-normal">
									File must exist
								</Label>
								<p className="text-xs text-muted-foreground">
									Throw error if file doesn't exist (otherwise creates new database)
								</p>
							</div>
							<Switch
								id="sqlite-must-exist-main"
								checked={form.fields.sqliteConfig.fileMustExist}
								onCheckedChange={(checked) =>
									form.setField("sqliteConfig", {
										...form.fields.sqliteConfig,
										fileMustExist: checked === true,
									})
								}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="sqlite-wal-main" className="font-normal">
									Enable WAL mode
								</Label>
								<p className="text-xs text-muted-foreground">
									Write-Ahead Logging for better concurrent access
								</p>
							</div>
							<Switch
								id="sqlite-wal-main"
								checked={form.fields.sqliteConfig.enableWAL}
								onCheckedChange={(checked) =>
									form.setField("sqliteConfig", {
										...form.fields.sqliteConfig,
										enableWAL: checked === true,
									})
								}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="sqlite-fk-main" className="font-normal">
									Enable foreign keys
								</Label>
								<p className="text-xs text-muted-foreground">Enforce foreign key constraints</p>
							</div>
							<Switch
								id="sqlite-fk-main"
								checked={form.fields.sqliteConfig.enableForeignKeys}
								onCheckedChange={(checked) =>
									form.setField("sqliteConfig", {
										...form.fields.sqliteConfig,
										enableForeignKeys: checked === true,
									})
								}
							/>
						</div>
					</div>
				</div>
			) : (
				<Tabs value={form.mode} onValueChange={handleModeChange} className="w-full">
					<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
						<TabsList className="shrink-0">
							<TabsTrigger value="fields" className="gap-2">
								<Server className="size-4" />
								<span className="hidden sm:inline">Discrete Fields</span>
								<span className="sm:hidden">Fields</span>
							</TabsTrigger>
							<TabsTrigger value="connectionString" className="gap-2">
								<LinkIcon className="size-4" />
								<span className="hidden sm:inline">Connection String</span>
								<span className="sm:hidden">String</span>
							</TabsTrigger>
						</TabsList>

						{/* Sync button */}
						{form.mode === "fields" && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => form.syncToConnectionString()}
								className="gap-2 shrink-0"
							>
								<ArrowRightLeft className="size-4" />
								<span className="hidden sm:inline">Generate String</span>
								<span className="sm:hidden">Generate</span>
							</Button>
						)}
						{form.mode === "connectionString" && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => form.syncFromConnectionString()}
								className="gap-2 shrink-0"
							>
								<ArrowRightLeft className="size-4" />
								<span className="hidden sm:inline">Parse to Fields</span>
								<span className="sm:hidden">Parse</span>
							</Button>
						)}
					</div>

					{/* Discrete Fields Mode */}
					<TabsContent value="fields" className="space-y-6">
						{/* Provider Type */}
						<FormField label="Database Type" error={form.errors.providerType} required>
							<Select
								value={form.fields.providerType}
								onValueChange={(value) => form.setField("providerType", value as ProviderType)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select database type" />
								</SelectTrigger>
								<SelectContent>
									{providerTypes.map((type) => {
										const isEnabled = enabledProviders.has(type);
										return (
											<SelectItem key={type} value={type} disabled={!isEnabled}>
												<span className="flex items-center gap-2">
													{providerConfig[type].icon}
													{providerConfig[type].label}
													{!isEnabled && (
														<span className="text-xs text-muted-foreground">
															(coming soon)
														</span>
													)}
												</span>
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
						</FormField>

						{/* Connection fields for non-SQLite providers (SQLite is handled separately above the Tabs) */}
						{/* Host & Port */}
						<FieldGroup>
							<FormField label="Host" error={form.errors.host} required>
								<div className="relative">
									<Server className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									<Input
										value={form.fields.host}
										onChange={(e) => form.setField("host", e.target.value)}
										placeholder="localhost"
										className="pl-10"
										aria-invalid={!!form.errors.host}
									/>
								</div>
							</FormField>

							<FormField label="Port" error={form.errors.port} required>
								<Input
									type="number"
									value={form.fields.port}
									onChange={(e) => form.setField("port", parseInt(e.target.value, 10) || 0)}
									min={1}
									max={65535}
									aria-invalid={!!form.errors.port}
								/>
							</FormField>
						</FieldGroup>

						{/* Database Name - not shown for postgres since we connect to a server */}
						{form.fields.providerType !== "postgres" && (
							<FormField label="Database" error={form.errors.database} required>
								<div className="relative">
									<Database className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									<Input
										value={form.fields.database}
										onChange={(e) => form.setField("database", e.target.value)}
										placeholder="my_database"
										className="pl-10"
										aria-invalid={!!form.errors.database}
									/>
								</div>
							</FormField>
						)}

						{/* Credentials */}
						<FieldGroup>
							<FormField label="Username" error={form.errors.username} required>
								<div className="relative">
									<User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									<Input
										value={form.fields.username}
										onChange={(e) => form.setField("username", e.target.value)}
										placeholder="postgres"
										className="pl-10"
										autoComplete="username"
										aria-invalid={!!form.errors.username}
									/>
								</div>
							</FormField>

							<FormField
								label="Password"
								error={form.errors.password}
								hint={isEditing ? "Leave blank to keep existing password" : undefined}
							>
								<div className="relative">
									<Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									<Input
										type={showPassword ? "text" : "password"}
										value={form.fields.password}
										onChange={(e) => form.setField("password", e.target.value)}
										placeholder={isEditing ? "••••••••" : "Enter password"}
										className="pl-10 pr-10"
										autoComplete="current-password"
										aria-invalid={!!form.errors.password}
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
										onClick={() => setShowPassword(!showPassword)}
									>
										{showPassword ? (
											<EyeOff className="size-4 text-muted-foreground" />
										) : (
											<Eye className="size-4 text-muted-foreground" />
										)}
										<span className="sr-only">
											{showPassword ? "Hide password" : "Show password"}
										</span>
									</Button>
								</div>
							</FormField>
						</FieldGroup>

						{/* SSL Configuration */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="ssl-enabled" className="font-normal flex items-center gap-2">
										<Lock className="size-4 text-muted-foreground" />
										Enable SSL/TLS encryption
									</Label>
								</div>
								<Switch
									id="ssl-enabled"
									checked={form.fields.sslConfig.enabled}
									onCheckedChange={(checked) =>
										form.setField("sslConfig", {
											...form.fields.sslConfig,
											enabled: checked === true,
										})
									}
								/>
							</div>

							{form.fields.sslConfig.enabled && (
								<div className="flex items-center justify-between pl-6">
									<Label htmlFor="ssl-reject-unauthorized" className="font-normal">
										Reject unauthorized certificates
									</Label>
									<Switch
										id="ssl-reject-unauthorized"
										checked={form.fields.sslConfig.rejectUnauthorized ?? true}
										onCheckedChange={(checked) =>
											form.setField("sslConfig", {
												...form.fields.sslConfig,
												rejectUnauthorized: checked === true,
											})
										}
									/>
								</div>
							)}
						</div>
					</TabsContent>

					{/* Connection String Mode */}
					<TabsContent value="connectionString" className="space-y-6">
						<FormField
							label="Connection String"
							error={form.errors.connectionString}
							required
							hint="Format: protocol://user:password@host:port/database?options"
						>
							<Textarea
								value={form.connectionString}
								onChange={(e) => form.setConnectionString(e.target.value)}
								placeholder="postgresql://user:password@localhost:5432/mydatabase?ssl=true"
								rows={3}
								className="font-mono text-sm break-all"
								aria-invalid={!!form.errors.connectionString}
							/>
						</FormField>

						{/* SSL override for connection string mode */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="ssl-enabled-string" className="font-normal flex items-center gap-2">
										<Lock className="size-4 text-muted-foreground" />
										Force SSL/TLS encryption
									</Label>
									<p className="text-xs text-muted-foreground">
										Override SSL settings from connection string
									</p>
								</div>
								<Switch
									id="ssl-enabled-string"
									checked={form.fields.sslConfig.enabled}
									onCheckedChange={(checked) =>
										form.setField("sslConfig", {
											...form.fields.sslConfig,
											enabled: checked === true,
										})
									}
								/>
							</div>

							{form.fields.sslConfig.enabled && (
								<div className="flex items-center justify-between pl-6">
									<Label htmlFor="ssl-reject-unauthorized-string" className="font-normal">
										Reject unauthorized certificates
									</Label>
									<Switch
										id="ssl-reject-unauthorized-string"
										checked={form.fields.sslConfig.rejectUnauthorized ?? true}
										onCheckedChange={(checked) =>
											form.setField("sslConfig", {
												...form.fields.sslConfig,
												rejectUnauthorized: checked === true,
											})
										}
									/>
								</div>
							)}
						</div>
					</TabsContent>
				</Tabs>
			)}

			{/* Advanced Options (Accordion) */}
			<div className="border rounded-lg">
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value="advanced" className="border-none">
					<AccordionTrigger className="px-4">
						<span className="flex items-center gap-2 text-sm font-medium">
							<Settings2 className="size-4" />
							Advanced Options
						</span>
					</AccordionTrigger>
					<AccordionContent className="px-4 pb-4 space-y-6">
						{/* Connection Pool Settings - Not applicable to SQLite */}
						{form.fields.providerType !== "sqlite" && (
							<div className="space-y-4">
								<h4 className="text-sm font-medium text-muted-foreground">Connection Pool</h4>
								<FieldGroup>
									<FormField
										label="Max Pool Size"
										error={form.errors.maxPoolSize}
										hint="Maximum number of connections (1-100)"
									>
										<Input
											type="number"
											value={form.fields.maxPoolSize}
											onChange={(e) =>
												form.setField("maxPoolSize", parseInt(e.target.value, 10) || 10)
											}
											min={1}
											max={100}
										/>
									</FormField>

									<FormField
										label="Idle Timeout (ms)"
										error={form.errors.idleTimeoutMs}
										hint="Close idle connections after this time"
									>
										<Input
											type="number"
											value={form.fields.idleTimeoutMs}
											onChange={(e) =>
												form.setField("idleTimeoutMs", parseInt(e.target.value, 10) || 30000)
											}
											min={0}
											max={3600000}
										/>
									</FormField>
								</FieldGroup>

								<FormField
									label="Connection Timeout (ms)"
									error={form.errors.connectionTimeoutMs}
									hint="Maximum time to establish connection"
									className="sm:w-1/2"
								>
									<Input
										type="number"
										value={form.fields.connectionTimeoutMs}
										onChange={(e) =>
											form.setField("connectionTimeoutMs", parseInt(e.target.value, 10) || 5000)
										}
										min={100}
										max={60000}
									/>
								</FormField>
							</div>
						)}

						{/* Metadata */}
						<div className="space-y-4">
							<h4 className="text-sm font-medium text-muted-foreground">Metadata</h4>

							<FormField label="Color" hint="Color label for visual identification">
								<Input
									type="color"
									value={form.fields.color || "#3B82F6"}
									onChange={(e) => form.setField("color", e.target.value)}
									className="h-10 w-20 p-1 cursor-pointer"
								/>
							</FormField>

							<FormField label="Notes" hint="Optional notes about this connection">
								<Textarea
									value={form.fields.notes || ""}
									onChange={(e) => form.setField("notes", e.target.value || null)}
									placeholder="Add any notes about this connection..."
									rows={3}
								/>
							</FormField>
						</div>
					</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>

			{/* Connection Test */}
			{onTest && (
				<div className="space-y-4">
					<ConnectionTestFeedback status={form.testStatus} result={form.testResult} />

					<Button
						type="button"
						variant="outline"
						onClick={() => form.testConnection()}
						disabled={form.testStatus === "testing"}
						className="gap-2"
					>
						{form.testStatus === "testing" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						Test Connection
					</Button>
				</div>
			)}

			{/* Form Actions */}
			<div className="flex items-center justify-end gap-3 pt-4">
				{showCancel && (
					<Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
						Cancel
					</Button>
				)}
				<Button type="submit" disabled={isSaving} className="gap-2">
					{isSaving && <Loader2 className="size-4 animate-spin" />}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
