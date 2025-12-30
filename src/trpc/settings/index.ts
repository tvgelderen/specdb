import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { db } from "~/db";
import { settings, type AppSettings } from "~/db/schema";
import logger from "~/lib/logging";

/**
 * Default settings values
 */
const defaultSettings: AppSettings = {
	warnOnDestructiveQueries: true,
};

/**
 * Get a setting value from the database or return the default
 */
function getSettingValue<K extends keyof AppSettings>(key: K): AppSettings[K] {
	const result = db.select().from(settings).where(eq(settings.key, key)).get();

	if (!result) {
		return defaultSettings[key];
	}

	try {
		return JSON.parse(result.value) as AppSettings[K];
	} catch {
		logger.warn(`[Settings] Failed to parse setting value for key: ${key}`);
		return defaultSettings[key];
	}
}

/**
 * Set a setting value in the database
 */
function setSettingValue<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
	const serializedValue = JSON.stringify(value);
	const existing = db.select().from(settings).where(eq(settings.key, key)).get();

	if (existing) {
		db.update(settings)
			.set({
				value: serializedValue,
				updatedAt: sql`datetime('now')`,
			})
			.where(eq(settings.key, key))
			.run();
	} else {
		db.insert(settings)
			.values({
				key,
				value: serializedValue,
			})
			.run();
	}
}

export const settingsRouter = router({
	/**
	 * Get all settings with their current values
	 */
	getAll: publicProcedure.query(async (): Promise<AppSettings> => {
		logger.info("[Settings] Getting all settings");

		return {
			warnOnDestructiveQueries: getSettingValue("warnOnDestructiveQueries"),
		};
	}),

	/**
	 * Get a specific setting value
	 */
	get: publicProcedure
		.input(z.object({ key: z.enum(["warnOnDestructiveQueries"]) }))
		.query(async ({ input }) => {
			logger.info(`[Settings] Getting setting: ${input.key}`);
			return getSettingValue(input.key);
		}),

	/**
	 * Update a setting value
	 */
	update: publicProcedure
		.input(
			z.object({
				key: z.enum(["warnOnDestructiveQueries"]),
				value: z.boolean(),
			})
		)
		.mutation(async ({ input }) => {
			logger.info(`[Settings] Updating setting: ${input.key} = ${input.value}`);

			setSettingValue(input.key, input.value);

			return {
				key: input.key,
				value: input.value,
			};
		}),

	/**
	 * Reset all settings to defaults
	 */
	resetToDefaults: publicProcedure.mutation(async () => {
		logger.info("[Settings] Resetting all settings to defaults");

		// Delete all settings to restore defaults
		db.delete(settings).run();

		return defaultSettings;
	}),
});
