import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface ZodIssue {
	message: string;
	path?: (string | number)[];
}

/**
 * Formats an error message for display to users.
 * Handles Zod validation errors (JSON arrays) and regular error messages.
 */
export function formatErrorMessage(message: string): string {
	// Check if it looks like a JSON array (Zod validation errors)
	const trimmed = message.trim();
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const issues = JSON.parse(trimmed) as ZodIssue[];
			if (Array.isArray(issues) && issues.length > 0) {
				// Return first issue's message, or combine if multiple
				if (issues.length === 1) {
					return issues[0].message;
				}
				return issues.map((issue) => issue.message).join(". ");
			}
		} catch {
			// Not valid JSON, return as-is
		}
	}
	return message;
}

export function asLocaleString(date: Date | null | undefined, options?: Intl.DateTimeFormatOptions) {
	if (!date) {
		return "-";
	}

	return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", hour12: false, ...options });
}
