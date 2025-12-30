import { z } from "zod/v4";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import logger from "~/lib/logging";

/**
 * File/directory entry returned by the filesystem API
 */
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
 * Directory listing result
 */
interface DirectoryListing {
	currentPath: string;
	parentPath: string | null;
	entries: FileEntry[];
	error: string | null;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get the file extension from a filename
 */
function getExtension(filename: string): string | null {
	const lastDot = filename.lastIndexOf(".");
	if (lastDot === -1 || lastDot === 0) return null;
	return filename.slice(lastDot).toLowerCase();
}

/**
 * Expand ~ to home directory
 */
function expandPath(path: string): string {
	if (path.startsWith("~")) {
		return join(homedir(), path.slice(1));
	}
	return path;
}

/**
 * Get parent directory path
 */
function getParentPath(path: string): string | null {
	const parent = dirname(path);
	// If parent is the same as path, we're at the root
	if (parent === path) return null;
	return parent;
}

export const filesystemRouter = router({
	/**
	 * List contents of a directory
	 */
	listDirectory: publicProcedure
		.input(
			z.object({
				path: z.string().default("~"),
				extensions: z.array(z.string()).optional(),
				showHidden: z.boolean().default(false),
			})
		)
		.query(async ({ input }): Promise<DirectoryListing> => {
			const expandedPath = expandPath(input.path);
			const resolvedPath = resolve(expandedPath);

			logger.debug(`[Filesystem] Listing directory: ${resolvedPath}`);

			try {
				const stats = await stat(resolvedPath);

				if (!stats.isDirectory()) {
					// If it's a file, list the parent directory
					const parentDir = dirname(resolvedPath);
					return listDirectoryContents(parentDir, input.extensions, input.showHidden);
				}

				return listDirectoryContents(resolvedPath, input.extensions, input.showHidden);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";
				logger.error(`[Filesystem] Error listing directory: ${message}`);
				return {
					currentPath: resolvedPath,
					parentPath: getParentPath(resolvedPath),
					entries: [],
					error: message,
				};
			}
		}),

	/**
	 * Get info about a specific file or directory
	 */
	getInfo: publicProcedure
		.input(z.object({ path: z.string() }))
		.query(async ({ input }) => {
			const expandedPath = expandPath(input.path);
			const resolvedPath = resolve(expandedPath);

			try {
				const stats = await stat(resolvedPath);
				return {
					name: basename(resolvedPath),
					path: resolvedPath,
					isDirectory: stats.isDirectory(),
					isFile: stats.isFile(),
					size: stats.size,
					sizeFormatted: formatBytes(stats.size),
					modifiedAt: stats.mtime.toISOString(),
					extension: stats.isFile() ? getExtension(basename(resolvedPath)) : null,
					exists: true,
				};
			} catch {
				return {
					name: basename(resolvedPath),
					path: resolvedPath,
					isDirectory: false,
					isFile: false,
					size: 0,
					sizeFormatted: "0 B",
					modifiedAt: null,
					extension: getExtension(basename(resolvedPath)),
					exists: false,
				};
			}
		}),

	/**
	 * Get common/quick-access paths
	 */
	getQuickAccessPaths: publicProcedure.query(async () => {
		const home = homedir();
		const cwd = process.cwd();

		const paths = [
			{ name: "Home", path: home, icon: "home" },
			{ name: "Current Directory", path: cwd, icon: "folder" },
			{ name: "Documents", path: join(home, "Documents"), icon: "folder" },
			{ name: "Downloads", path: join(home, "Downloads"), icon: "folder" },
			{ name: "Desktop", path: join(home, "Desktop"), icon: "folder" },
		];

		// Filter out paths that don't exist
		const validPaths = [];
		for (const p of paths) {
			try {
				await stat(p.path);
				validPaths.push(p);
			} catch {
				// Path doesn't exist, skip it
			}
		}

		return validPaths;
	}),
});

/**
 * List directory contents with filtering
 */
async function listDirectoryContents(
	dirPath: string,
	extensions?: string[],
	showHidden = false
): Promise<DirectoryListing> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		const fileEntries: FileEntry[] = [];

		for (const entry of entries) {
			// Skip hidden files unless requested
			if (!showHidden && entry.name.startsWith(".")) {
				continue;
			}

			const fullPath = join(dirPath, entry.name);
			const isDir = entry.isDirectory();
			const isFile = entry.isFile();

			// For files, check extension filter
			if (isFile && extensions && extensions.length > 0) {
				const ext = getExtension(entry.name);
				if (!ext || !extensions.includes(ext)) {
					continue;
				}
			}

			let size = 0;
			let modifiedAt = new Date().toISOString();

			try {
				const stats = await stat(fullPath);
				size = stats.size;
				modifiedAt = stats.mtime.toISOString();
			} catch {
				// Can't stat, use defaults
			}

			fileEntries.push({
				name: entry.name,
				path: fullPath,
				isDirectory: isDir,
				isFile: isFile,
				size,
				modifiedAt,
				extension: isFile ? getExtension(entry.name) : null,
			});
		}

		// Sort: directories first, then files, both alphabetically
		fileEntries.sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) return -1;
			if (!a.isDirectory && b.isDirectory) return 1;
			return a.name.localeCompare(b.name);
		});

		return {
			currentPath: dirPath,
			parentPath: getParentPath(dirPath),
			entries: fileEntries,
			error: null,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			currentPath: dirPath,
			parentPath: getParentPath(dirPath),
			entries: [],
			error: message,
		};
	}
}
