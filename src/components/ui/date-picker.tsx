import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export function DatePicker({
	value,
	onDateChange,
	placeholder = "Pick a date",
	className,
	disabled,
	disabledDates,
}: React.HTMLAttributes<HTMLDivElement> & {
	value: Date | undefined;
	onDateChange: (date: Date | undefined) => void;
	placeholder?: string;
	disabled?: boolean;
	disabledDates?: (date: Date) => boolean;
}) {
	const [date, setDate] = React.useState<Date | undefined>(value);
	const [isOpen, setIsOpen] = React.useState(false);

	React.useEffect(() => {
		if (isOpen) {
			setDate(value);
		}
	}, [isOpen, value]);

	function handleDateChange(date: Date | undefined) {
		setDate(date);
	}

	function handleOpenChange(open: boolean) {
		setIsOpen(open);
		if (!open && date !== value) {
			onDateChange(date);
		}
	}

	const displayDate = isOpen ? date : value;

	return (
		<div className={cn("grid gap-2", className)}>
			<Popover open={isOpen} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className={cn(
							"w-full justify-start text-left font-normal",
							!displayDate && "text-muted-foreground",
						)}
						disabled={disabled}
					>
						<CalendarIcon className="size-4" />
						{displayDate ? format(displayDate, "PPP") : <span>{placeholder}</span>}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						autoFocus
						mode="single"
						defaultMonth={value}
						selected={date}
						onSelect={handleDateChange}
						disabled={disabledDates}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
