import { ChevronDown, Radio } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getPredictionIntervalOptions, type PredictionIntervalOption } from "@/lib/predictionSimulation";

const formatTime = (timestamp: number) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(timestamp);

export function MarketIntervalSelector({ now, currentWindowStart, selectedWindowStart, intervalMinutes, onSelect }: {
  now: number;
  currentWindowStart: number;
  selectedWindowStart: number;
  intervalMinutes: number;
  onSelect: (startTime: number | null) => void;
}) {
  const intervalMs = intervalMinutes * 60_000;
  const visible = getPredictionIntervalOptions(now, [-2, -1, 0, 1, 2], intervalMs);
  const past = getPredictionIntervalOptions(now, [-8, -7, -6, -5, -4, -3], intervalMs);
  const upcoming = getPredictionIntervalOptions(now, [3, 4, 5, 6, 7, 8], intervalMs);
  const selectedIsOlder = selectedWindowStart < visible[0].startTime;
  const selectedIsLater = selectedWindowStart > visible.at(-1)!.startTime;

  const choose = (option: PredictionIntervalOption) => onSelect(option.startTime === currentWindowStart ? null : option.startTime);

  return (
    <nav className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1" aria-label={`${intervalMinutes}-minute prediction market intervals`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(intervalClass, selectedIsOlder && selectedClass)} aria-label="Choose an earlier market interval">Past <ChevronDown className="h-3.5 w-3.5" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-36">
          {past.reverse().map((option) => <DropdownMenuItem key={option.startTime} onSelect={() => choose(option)}>{formatTime(option.startTime)} – {formatTime(option.endTime)}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>

      {visible.map((option) => {
        const selected = option.startTime === selectedWindowStart;
        return (
          <button
            key={option.startTime}
            type="button"
            aria-pressed={selected}
            aria-label={`${formatTime(option.startTime)} market, ${option.state.toLowerCase()}`}
            onClick={() => choose(option)}
            className={cn(intervalClass, "shrink-0", selected && selectedClass)}
          >
            {option.state === "LIVE" && <Radio className="h-3.5 w-3.5 fill-sell text-sell" aria-hidden="true" />}
            {formatTime(option.startTime)}
          </button>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(intervalClass, selectedIsLater && selectedClass)} aria-label="Choose a later market interval">More <ChevronDown className="h-3.5 w-3.5" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          {upcoming.map((option) => <DropdownMenuItem key={option.startTime} onSelect={() => choose(option)}>{formatTime(option.startTime)} – {formatTime(option.endTime)}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only">Intervals are {intervalMinutes} minutes long.</span>
    </nav>
  );
}

const intervalClass = "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-muted/35 px-4 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const selectedClass = "border-primary/30 bg-foreground text-background hover:bg-foreground hover:text-background";
