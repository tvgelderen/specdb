import * as React from "react";
import { createContext, useContext, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import type { AppSettings } from "~/db/schema";

/**
 * Default settings values (used during loading)
 */
const defaultSettings: AppSettings = {
	warnOnDestructiveQueries: true,
};

/**
 * Settings context type
 */
interface SettingsContextType {
	/** Current settings values */
	settings: AppSettings;
	/** Loading state for settings */
	isLoading: boolean;
	/** Error state */
	error: unknown;
	/** Update a setting value */
	updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
	/** Reset all settings to defaults */
	resetToDefaults: () => Promise<void>;
	/** Whether an operation is in progress */
	isOperationPending: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
	children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Fetch all settings
	const settingsQuery = useQuery(trpc.settings.getAll.queryOptions());

	// Update setting mutation
	const updateMutation = useMutation(
		trpc.settings.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.settings.getAll.queryKey() });
			},
		})
	);

	// Reset to defaults mutation
	const resetMutation = useMutation(
		trpc.settings.resetToDefaults.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.settings.getAll.queryKey() });
			},
		})
	);

	// Callbacks
	const updateSetting = useCallback(
		async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
			await updateMutation.mutateAsync({
				key: key as "warnOnDestructiveQueries",
				value: value as boolean,
			});
		},
		[updateMutation]
	);

	const resetToDefaults = useCallback(async () => {
		await resetMutation.mutateAsync();
	}, [resetMutation]);

	const value: SettingsContextType = {
		settings: settingsQuery.data ?? defaultSettings,
		isLoading: settingsQuery.isLoading,
		error: settingsQuery.error,
		updateSetting,
		resetToDefaults,
		isOperationPending: updateMutation.isPending || resetMutation.isPending,
	};

	return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/**
 * Hook to access settings context
 */
export function useSettings() {
	const context = useContext(SettingsContext);
	if (context === undefined) {
		throw new Error("useSettings must be used within a SettingsProvider");
	}
	return context;
}

/**
 * Hook to get just the destructive query warning setting
 */
export function useDestructiveQueryWarning() {
	const { settings, isLoading } = useSettings();
	return {
		warnOnDestructiveQueries: settings.warnOnDestructiveQueries,
		isLoading,
	};
}
