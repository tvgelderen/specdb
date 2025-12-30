import { TRPCError } from "@trpc/server";
import { middleware } from "~/trpc/init";
import type { ExplorerPermission } from "~/trpc/explorer/types";
import logger from "~/lib/logging";

/**
 * User context for permission checking
 */
export interface UserContext {
	userId?: string;
	permissions: ExplorerPermission[];
}

/**
 * Extract user context from request headers
 * In a real application, this would verify JWT tokens, session cookies, etc.
 */
function extractUserContext(headers: Headers): UserContext {
	// Check for authorization header
	const authHeader = headers.get("authorization");
	const userIdHeader = headers.get("x-user-id");
	const permissionsHeader = headers.get("x-user-permissions");

	// Parse permissions from header (comma-separated)
	const permissions: ExplorerPermission[] = permissionsHeader
		? (permissionsHeader.split(",").map((p) => p.trim()) as ExplorerPermission[])
		: [];

	// If no auth header, return anonymous user with basic view permissions
	if (!authHeader && !userIdHeader) {
		return {
			permissions: ["explorer.view", "explorer.databases.list", "explorer.schemas.list", "explorer.tables.list", "explorer.tables.read"],
		};
	}

	return {
		userId: userIdHeader ?? undefined,
		permissions: permissions.length > 0 ? permissions : ["explorer.view"],
	};
}

/**
 * Permission middleware that adds user context to the request
 */
export const withUserContext = middleware(async ({ ctx, next }) => {
	const userContext = extractUserContext(ctx.headers);

	logger.debug("[Permission] User context extracted", {
		userId: userContext.userId,
		permissionCount: userContext.permissions.length,
	});

	return next({
		ctx: {
			...ctx,
			user: userContext,
		},
	});
});

/**
 * Create a permission check middleware for specific permissions
 */
export function requirePermission(...requiredPermissions: ExplorerPermission[]) {
	return middleware(async ({ ctx, next }) => {
		const userContext = extractUserContext(ctx.headers);

		// Check if user has all required permissions
		const missingPermissions = requiredPermissions.filter(
			(perm) => !userContext.permissions.includes(perm)
		);

		if (missingPermissions.length > 0) {
			logger.warn("[Permission] Access denied - missing permissions", {
				userId: userContext.userId,
				required: requiredPermissions,
				missing: missingPermissions,
			});

			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Missing required permissions: ${missingPermissions.join(", ")}`,
			});
		}

		logger.debug("[Permission] Access granted", {
			userId: userContext.userId,
			permissions: requiredPermissions,
		});

		return next({
			ctx: {
				...ctx,
				user: userContext,
			},
		});
	});
}

/**
 * Create a permission check middleware that requires ANY of the specified permissions
 */
export function requireAnyPermission(...requiredPermissions: ExplorerPermission[]) {
	return middleware(async ({ ctx, next }) => {
		const userContext = extractUserContext(ctx.headers);

		// Check if user has at least one of the required permissions
		const hasAnyPermission = requiredPermissions.some((perm) =>
			userContext.permissions.includes(perm)
		);

		if (!hasAnyPermission) {
			logger.warn("[Permission] Access denied - no matching permissions", {
				userId: userContext.userId,
				required: requiredPermissions,
				userPermissions: userContext.permissions,
			});

			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Requires one of: ${requiredPermissions.join(", ")}`,
			});
		}

		logger.debug("[Permission] Access granted (any permission)", {
			userId: userContext.userId,
			matchedPermissions: requiredPermissions.filter((p) => userContext.permissions.includes(p)),
		});

		return next({
			ctx: {
				...ctx,
				user: userContext,
			},
		});
	});
}
