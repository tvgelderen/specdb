import { useTheme } from "next-themes";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Moon, Sun } from "lucide-react";

export function ThemeSwitch() {
	const { theme, setTheme } = useTheme();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setTheme(theme === "light" ? "dark" : "light")}
					className="size-8 hover:bg-accent/80"
				>
					<Sun className="size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
					<Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={8}>
				<p className="text-xs">Switch to {theme === "light" ? "dark" : "light"} mode</p>
			</TooltipContent>
		</Tooltip>
	);
}
