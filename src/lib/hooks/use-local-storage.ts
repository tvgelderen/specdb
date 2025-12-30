import * as React from "react";

/**
 * Custom hook for persisting state to localStorage
 * Provides a useState-like API with automatic localStorage sync
 *
 * @param key - The localStorage key to use
 * @param initialValue - Initial value (used if no stored value exists)
 * @returns Tuple of [value, setValue] like useState
 */
export function useLocalStorage<T>(
	key: string,
	initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
	// Get initial value from localStorage or use provided initial value
	const [storedValue, setStoredValue] = React.useState<T>(() => {
		if (typeof window === "undefined") {
			return initialValue;
		}

		try {
			const item = window.localStorage.getItem(key);
			if (item) {
				return JSON.parse(item) as T;
			}
			return initialValue;
		} catch (error) {
			console.warn(`[useLocalStorage] Error reading localStorage key "${key}":`, error);
			return initialValue;
		}
	});

	// Update localStorage when value changes
	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		try {
			window.localStorage.setItem(key, JSON.stringify(storedValue));
		} catch (error) {
			console.warn(`[useLocalStorage] Error writing localStorage key "${key}":`, error);
		}
	}, [key, storedValue]);

	return [storedValue, setStoredValue];
}

/**
 * Custom hook for persisting a Set to localStorage
 * Serializes the Set as an array for JSON storage
 *
 * @param key - The localStorage key to use
 * @param initialValue - Initial Set value (used if no stored value exists)
 * @returns Tuple of [value, setValue] like useState
 */
export function useLocalStorageSet<T>(
	key: string,
	initialValue: Set<T> = new Set()
): [Set<T>, React.Dispatch<React.SetStateAction<Set<T>>>] {
	// Get initial value from localStorage or use provided initial value
	const [storedValue, setStoredValue] = React.useState<Set<T>>(() => {
		if (typeof window === "undefined") {
			return initialValue;
		}

		try {
			const item = window.localStorage.getItem(key);
			if (item) {
				const parsed = JSON.parse(item) as T[];
				if (Array.isArray(parsed)) {
					return new Set(parsed);
				}
			}
			return initialValue;
		} catch (error) {
			console.warn(`[useLocalStorageSet] Error reading localStorage key "${key}":`, error);
			return initialValue;
		}
	});

	// Update localStorage when value changes
	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		try {
			window.localStorage.setItem(key, JSON.stringify(Array.from(storedValue)));
		} catch (error) {
			console.warn(`[useLocalStorageSet] Error writing localStorage key "${key}":`, error);
		}
	}, [key, storedValue]);

	return [storedValue, setStoredValue];
}
