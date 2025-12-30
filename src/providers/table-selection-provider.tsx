import * as React from "react";
import { createContext, useContext, useCallback } from "react";
import { useLocalStorage } from "~/lib/hooks";

/**
 * Selected table information
 */
export interface SelectedTable {
	/** Table type */
	type: "table" | "view" | "materialized_view";
	/** Database name (optional) */
	database?: string;
	/** Schema name */
	schema: string;
	/** Table name */
	table: string;
}

/**
 * Table selection context type
 */
interface TableSelectionContextType {
	/** Currently selected table */
	selectedTable: SelectedTable | null;
	/** Set the selected table */
	setSelectedTable: (table: SelectedTable | null) => void;
	/** Clear the selection */
	clearSelection: () => void;
}

const TableSelectionContext = createContext<TableSelectionContextType | undefined>(undefined);

/** localStorage key for selected table persistence */
const SELECTED_TABLE_STORAGE_KEY = "explorer-selected-table";

interface TableSelectionProviderProps {
	children: React.ReactNode;
}

export function TableSelectionProvider({ children }: TableSelectionProviderProps) {
	// Persist selected table to localStorage
	const [selectedTable, setSelectedTableState] = useLocalStorage<SelectedTable | null>(
		SELECTED_TABLE_STORAGE_KEY,
		null
	);

	const setSelectedTable = useCallback((table: SelectedTable | null) => {
		setSelectedTableState(table);
	}, [setSelectedTableState]);

	const clearSelection = useCallback(() => {
		setSelectedTableState(null);
	}, [setSelectedTableState]);

	const value: TableSelectionContextType = {
		selectedTable,
		setSelectedTable,
		clearSelection,
	};

	return (
		<TableSelectionContext.Provider value={value}>
			{children}
		</TableSelectionContext.Provider>
	);
}

/**
 * Hook to access table selection context
 */
export function useTableSelection() {
	const context = useContext(TableSelectionContext);
	if (context === undefined) {
		throw new Error("useTableSelection must be used within a TableSelectionProvider");
	}
	return context;
}
