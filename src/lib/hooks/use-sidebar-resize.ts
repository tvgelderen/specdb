import * as React from "react";

/** Default sidebar width constraints */
export const SIDEBAR_WIDTH = {
	MIN: 200,
	MAX: 500,
	DEFAULT: 256,
	COLLAPSED: 48,
	MOBILE: 288,
} as const;

export interface UseSidebarResizeOptions {
	/** Initial width of the sidebar */
	initialWidth?: number;
	/** Minimum allowed width */
	minWidth?: number;
	/** Maximum allowed width */
	maxWidth?: number;
	/** Callback when width changes */
	onWidthChange?: (width: number) => void;
	/** Whether the sidebar is collapsed */
	isCollapsed?: boolean;
}

export interface UseSidebarResizeReturn {
	/** Current sidebar width */
	width: number;
	/** Whether the user is currently resizing */
	isResizing: boolean;
	/** Props to spread on the resize handle element */
	resizeHandleProps: {
		onMouseDown: (e: React.MouseEvent) => void;
		onTouchStart: (e: React.TouchEvent) => void;
		style: React.CSSProperties;
		role: string;
		"aria-label": string;
		tabIndex: number;
		onKeyDown: (e: React.KeyboardEvent) => void;
	};
	/** Set width programmatically */
	setWidth: (width: number) => void;
	/** Reset width to default */
	resetWidth: () => void;
}

/**
 * Hook for managing sidebar resize functionality
 * Handles mouse/touch events, width constraints, and provides accessible keyboard support
 */
export function useSidebarResize({
	initialWidth = SIDEBAR_WIDTH.DEFAULT,
	minWidth = SIDEBAR_WIDTH.MIN,
	maxWidth = SIDEBAR_WIDTH.MAX,
	onWidthChange,
	isCollapsed = false,
}: UseSidebarResizeOptions = {}): UseSidebarResizeReturn {
	const [width, setWidthState] = React.useState(initialWidth);
	const [isResizing, setIsResizing] = React.useState(false);

	// Refs for tracking drag state
	const startXRef = React.useRef(0);
	const startWidthRef = React.useRef(initialWidth);

	// Sync with external initial width changes
	React.useEffect(() => {
		if (!isResizing) {
			setWidthState(initialWidth);
		}
	}, [initialWidth, isResizing]);

	// Clamp width to constraints
	const clampWidth = React.useCallback(
		(w: number) => Math.min(Math.max(w, minWidth), maxWidth),
		[minWidth, maxWidth]
	);

	// Set width with constraints
	const setWidth = React.useCallback(
		(newWidth: number) => {
			const clamped = clampWidth(newWidth);
			setWidthState(clamped);
			onWidthChange?.(clamped);
		},
		[clampWidth, onWidthChange]
	);

	// Reset to default width
	const resetWidth = React.useCallback(() => {
		setWidth(SIDEBAR_WIDTH.DEFAULT);
	}, [setWidth]);

	// Handle mouse/touch move during resize
	const handleMove = React.useCallback(
		(clientX: number) => {
			const deltaX = clientX - startXRef.current;
			const newWidth = startWidthRef.current + deltaX;
			setWidth(newWidth);
		},
		[setWidth]
	);

	// Handle mouse/touch end
	const handleEnd = React.useCallback(() => {
		setIsResizing(false);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}, []);

	// Set up and clean up event listeners
	React.useEffect(() => {
		if (!isResizing) return;

		const handleMouseMove = (e: MouseEvent) => {
			e.preventDefault();
			handleMove(e.clientX);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length === 1) {
				handleMove(e.touches[0].clientX);
			}
		};

		const handleMouseUp = () => handleEnd();
		const handleTouchEnd = () => handleEnd();

		// Add event listeners
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		document.addEventListener("touchmove", handleTouchMove, { passive: true });
		document.addEventListener("touchend", handleTouchEnd);

		// Prevent text selection during resize
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handleTouchEnd);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, [isResizing, handleMove, handleEnd]);

	// Handle mouse down on resize handle
	const handleMouseDown = React.useCallback(
		(e: React.MouseEvent) => {
			if (isCollapsed) return;
			e.preventDefault();
			startXRef.current = e.clientX;
			startWidthRef.current = width;
			setIsResizing(true);
		},
		[width, isCollapsed]
	);

	// Handle touch start on resize handle
	const handleTouchStart = React.useCallback(
		(e: React.TouchEvent) => {
			if (isCollapsed) return;
			if (e.touches.length === 1) {
				startXRef.current = e.touches[0].clientX;
				startWidthRef.current = width;
				setIsResizing(true);
			}
		},
		[width, isCollapsed]
	);

	// Handle keyboard resize (accessibility)
	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent) => {
			if (isCollapsed) return;

			const step = e.shiftKey ? 50 : 10;
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				setWidth(width - step);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				setWidth(width + step);
			} else if (e.key === "Home") {
				e.preventDefault();
				setWidth(minWidth);
			} else if (e.key === "End") {
				e.preventDefault();
				setWidth(maxWidth);
			}
		},
		[width, minWidth, maxWidth, setWidth, isCollapsed]
	);

	const resizeHandleProps = React.useMemo(
		() => ({
			onMouseDown: handleMouseDown,
			onTouchStart: handleTouchStart,
			onKeyDown: handleKeyDown,
			style: {
				cursor: isCollapsed ? "default" : "col-resize",
			} as React.CSSProperties,
			role: "separator",
			"aria-label": "Resize sidebar",
			tabIndex: isCollapsed ? -1 : 0,
		}),
		[handleMouseDown, handleTouchStart, handleKeyDown, isCollapsed]
	);

	return {
		width,
		isResizing,
		resizeHandleProps,
		setWidth,
		resetWidth,
	};
}
