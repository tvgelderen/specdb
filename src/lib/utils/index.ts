import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function asLocaleString(date: Date | null | undefined, options?: Intl.DateTimeFormatOptions) {
	if (!date) {
		return "-";
	}

	return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", hour12: false, ...options });
}
