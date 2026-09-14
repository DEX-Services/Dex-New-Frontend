import { CalendarClock, Database, Gauge, ShieldCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPredictionDate, formatPredictionVolume, type PredictionMarket } from "@/lib/predictionMarkets";

export function MarketInformation({ market }: { market: PredictionMarket }) {
  return (
    <section className="glass rounded-xl p-4 sm:p-5" aria-labelledby="market-information-title">
      <h2 id="market-information-title" className="sr-only">Rules and market context</h2>
      <Tabs defaultValue="rules">
        <TabsList className="grid w-full grid-cols-2 sm:w-80"><TabsTrigger value="rules">Rules</TabsTrigger><TabsTrigger value="context">Market Context</TabsTrigger></TabsList>
        <TabsContent value="rules" className="mt-5 space-y-4">
          <div><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />How this market resolves</h3><ol className="mt-3 space-y-2 text-sm text-muted-foreground">{market.rules.map((rule, index) => <li key={rule} className="flex gap-3"><span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">{index + 1}</span><span>{rule}</span></li>)}</ol></div>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-3"><h4 className="text-xs font-semibold text-warning">Edge cases</h4><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{market.edgeCase}</p></div>
          <p className="text-[10px] text-muted-foreground">This frontend preview does not perform automatic resolution or move funds.</p>
        </TabsContent>
        <TabsContent value="context" className="mt-5 space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{market.description}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <ContextItem icon={Gauge} label="Market type" value={market.marketType.replace(/_/g, " ")} />
            <ContextItem icon={CalendarClock} label="Resolution" value={formatPredictionDate(market.resolutionDate)} />
            <ContextItem icon={Database} label="Resolution source" value={market.priceSource} />
            <ContextItem icon={Users} label="Participation" value={`${market.participants.toLocaleString()} traders · ${formatPredictionVolume(market.volume)} volume`} />
          </dl>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ContextItem({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="rounded-lg border border-border/50 bg-muted/20 p-3"><dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{label}</dt><dd className="mt-1.5 text-xs font-medium">{value}</dd></div>;
}
