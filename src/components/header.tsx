import { Link } from "@tanstack/react-router";
import { MenuIcon, Database, Table2, Link2, Terminal, Settings } from "lucide-react";
import { ThemeSwitch } from "~/components/theme-switch";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface HeaderProps {
	/** Callback for mobile menu button click */
	onMenuClick?: () => void;
}

const navItems = [
	{ to: "/", label: "Table", icon: Table2 },
	{ to: "/sql-editor", label: "SQL Editor", icon: Terminal },
	{ to: "/settings", label: "Settings", icon: Settings },
	{ to: "/connections", label: "Connections", icon: Link2 },
] as const;

export function Header({ onMenuClick }: HeaderProps) {
	return (
		<header className="flex items-center h-14 px-4 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
			{/* Left side: Menu button (mobile) + Logo */}
			<div className="flex items-center gap-2">
				{/* Mobile menu button */}
				{onMenuClick && (
					<Button
						variant="ghost"
						size="icon"
						onClick={onMenuClick}
						className="md:hidden size-8 hover:bg-accent/80"
						aria-label="Open navigation menu"
					>
						<MenuIcon className="size-4" />
					</Button>
				)}

				{/* Logo */}
				<a href="/" className="flex items-center gap-2.5 group transition-opacity hover:opacity-80">
					<div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
						<Database className="size-4 text-primary" />
					</div>
					<span className="text-base font-semibold tracking-tight hidden sm:block">SpecDB</span>
				</a>
			</div>

			{/* Center: Desktop Navigation */}
			<nav className="hidden md:flex items-center justify-center gap-1 flex-1 ml-8">
				{navItems.map(({ to, label, icon: Icon }) => (
					<Link
						key={to}
						to={to}
						className={cn(
							"relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md",
							"text-muted-foreground hover:text-foreground hover:bg-accent/50",
							"transition-all duration-150",
							"[&.active]:text-foreground [&.active]:bg-accent",
						)}
					>
						<Icon className="size-3.5" />
						{label}
					</Link>
				))}
			</nav>

			{/* Right side: Actions */}
			<div className="flex items-center gap-2 ml-auto">
				<ThemeSwitch />
			</div>
		</header>
	);
}
