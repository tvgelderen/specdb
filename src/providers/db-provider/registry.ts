import logger from "~/lib/logging";
import type { DbProvider } from "./interface";
import type {
	BaseConnectionConfig,
	CapabilityMap,
	DbCapability,
	ProviderRegistration,
	ProviderType,
} from "./types";

/**
 * Provider Registry for managing database provider registrations and instances.
 * Provides a centralized way to register, discover, and instantiate providers.
 */
class ProviderRegistryClass {
	private registrations = new Map<ProviderType, ProviderRegistration>();
	private instanceCache = new Map<string, DbProvider>();

	/**
	 * Register a new provider type
	 */
	register<TConfig extends BaseConnectionConfig>(
		registration: ProviderRegistration<TConfig>
	): void {
		if (this.registrations.has(registration.type)) {
			logger.warn(
				`[ProviderRegistry] Provider ${registration.type} is already registered, overwriting`
			);
		}

		this.registrations.set(registration.type, registration as ProviderRegistration);
		logger.info(
			`[ProviderRegistry] Registered provider: ${registration.name} (${registration.type}) v${registration.version}`
		);
	}

	/**
	 * Unregister a provider type
	 */
	unregister(type: ProviderType): boolean {
		const removed = this.registrations.delete(type);
		if (removed) {
			// Clear any cached instances for this provider type
			for (const [key, instance] of this.instanceCache.entries()) {
				if (instance.type === type) {
					this.instanceCache.delete(key);
				}
			}
			logger.info(`[ProviderRegistry] Unregistered provider: ${type}`);
		}
		return removed;
	}

	/**
	 * Get a registered provider by type
	 */
	getRegistration(type: ProviderType): ProviderRegistration | undefined {
		return this.registrations.get(type);
	}

	/**
	 * Get all registered providers
	 */
	getAllRegistrations(): ProviderRegistration[] {
		return Array.from(this.registrations.values());
	}

	/**
	 * Get provider types
	 */
	getProviderTypes(): ProviderType[] {
		return Array.from(this.registrations.keys());
	}

	/**
	 * Check if a provider type is registered
	 */
	isRegistered(type: ProviderType): boolean {
		return this.registrations.has(type);
	}

	/**
	 * Create a new provider instance
	 */
	createProvider<TConfig extends BaseConnectionConfig>(
		type: ProviderType,
		config: TConfig
	): DbProvider<TConfig> {
		const registration = this.registrations.get(type);
		if (!registration) {
			throw new Error(`Provider type '${type}' is not registered`);
		}

		const provider = registration.factory(config) as DbProvider<TConfig>;
		logger.debug(`[ProviderRegistry] Created new provider instance: ${type}`);
		return provider;
	}

	/**
	 * Get or create a cached provider instance
	 */
	async getOrCreateProvider<TConfig extends BaseConnectionConfig>(
		type: ProviderType,
		config: TConfig,
		cacheKey?: string
	): Promise<DbProvider<TConfig>> {
		const key = cacheKey ?? this.generateCacheKey(type, config);

		let provider = this.instanceCache.get(key) as DbProvider<TConfig> | undefined;
		if (!provider) {
			provider = this.createProvider(type, config);
			await provider.connect();
			this.instanceCache.set(key, provider);
			logger.info(`[ProviderRegistry] Created and cached provider: ${key}`);
		}

		return provider;
	}

	/**
	 * Generate a cache key for a provider configuration
	 */
	private generateCacheKey(type: ProviderType, config: BaseConnectionConfig): string {
		const configStr = JSON.stringify(config, Object.keys(config).sort());
		return `${type}:${configStr}`;
	}

	/**
	 * Remove a cached provider instance
	 */
	async removeFromCache(cacheKey: string): Promise<boolean> {
		const provider = this.instanceCache.get(cacheKey);
		if (provider) {
			await provider.disconnect();
			this.instanceCache.delete(cacheKey);
			logger.info(`[ProviderRegistry] Removed provider from cache: ${cacheKey}`);
			return true;
		}
		return false;
	}

	/**
	 * Clear all cached provider instances
	 */
	async clearCache(): Promise<void> {
		for (const [key, provider] of this.instanceCache.entries()) {
			try {
				await provider.disconnect();
			} catch (error) {
				logger.error(`[ProviderRegistry] Error disconnecting provider ${key}:`, error);
			}
		}
		this.instanceCache.clear();
		logger.info("[ProviderRegistry] Cleared all cached providers");
	}

	/**
	 * Get all cached provider instances
	 */
	getCachedProviders(): Map<string, DbProvider> {
		return new Map(this.instanceCache);
	}

	/**
	 * Get capability summary for all registered providers
	 */
	getCapabilitySummary(): Record<ProviderType, DbCapability[]> {
		const summary: Record<string, DbCapability[]> = {};
		for (const [type, registration] of this.registrations) {
			summary[type] = registration.capabilities;
		}
		return summary as Record<ProviderType, DbCapability[]>;
	}

	/**
	 * Find providers that support specific capabilities
	 */
	findProvidersWithCapabilities(capabilities: DbCapability[]): ProviderRegistration[] {
		return Array.from(this.registrations.values()).filter((registration) =>
			capabilities.every((cap) => registration.capabilities.includes(cap))
		);
	}

	/**
	 * Get detailed capability maps for all registered providers
	 */
	getCapabilityMaps(): CapabilityMap[] {
		const cachedProviders = Array.from(this.instanceCache.values());
		return cachedProviders.map((provider) => provider.getCapabilities());
	}
}

// Singleton instance
export const ProviderRegistry = new ProviderRegistryClass();

// Export for testing purposes
export { ProviderRegistryClass };
