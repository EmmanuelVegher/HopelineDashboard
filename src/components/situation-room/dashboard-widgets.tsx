import { ArrowUp, ArrowDown, Users, Home, AlertTriangle, Activity, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface KPICardProps {
    title: string;
    value: string | number;
    subtext?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    icon: React.ElementType;
    variant?: 'red' | 'blue' | 'green' | 'purple';
}

export const KPICard = ({ title, value, subtext, trend, trendValue, icon: Icon, variant = 'blue' }: KPICardProps) => {

    // Existing Dashboard Styles: Soft pastel backgrounds, clean icons
    const variants = {
        red: "bg-[#fff5f5] border-[#fde2e2] text-[#9b2c2c]",
        blue: "bg-[#f0f7ff] border-[#e0efff] text-[#2b6cb0]",
        green: "bg-[#f0fff4] border-[#d7ffd9] text-[#276749]",
        purple: "bg-[#faf5ff] border-[#f3e8ff] text-[#553c9a]",
    };

    const iconColors = {
        red: "text-red-500 bg-red-100/50",
        blue: "text-blue-500 bg-blue-100/50",
        green: "text-green-500 bg-green-100/50",
        purple: "text-purple-500 bg-purple-100/50",
    };

    return (
        <Card className={cn("p-6 rounded-2xl border transition-all duration-300 hover:shadow-md h-full relative overflow-hidden", variants[variant])}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-bold opacity-80 mb-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight">{value}</span>
                        {subtext && <span className="text-[10px] font-bold opacity-60 uppercase">{subtext}</span>}
                    </div>
                    {(trend || trendValue) && (
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-bold uppercase opacity-80">
                            {trend === 'up' && <ArrowUp className="h-3 w-3" />}
                            {trend === 'down' && <ArrowDown className="h-3 w-3" />}
                            <span>{trendValue}</span>
                        </div>
                    )}
                </div>
                <div className={cn("p-2.5 rounded-xl border border-white/50 shadow-sm", iconColors[variant])}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            {/* Subtle decorative circle */}
            <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-white/10" />
        </Card>
    );
}

export const SituationWidgets = ({ kpis }: { kpis: any }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
                title="Active Alerts"
                value={kpis.activeAlerts}
                subtext="from last hour"
                icon={AlertTriangle}
                trend="up"
                trendValue="from last hour"
                variant="red"
            />
            <KPICard
                title="People Assisted"
                value={kpis.totalDisplaced.toLocaleString()}
                subtext="Total individuals"
                icon={Users}
                trend="neutral"
                trendValue="Total individuals in shelters"
                variant="blue"
            />
            <KPICard
                title="Shelter Occupancy"
                value={`${kpis.occupancyRate}%`}
                subtext={`${kpis.occupiedCapacity}/${kpis.totalCapacity} capacity`}
                icon={Home}
                trend="up"
                trendValue="0/25 capacity"
                variant="green"
            />
            <KPICard
                title="Avg Response Time"
                value="12.5 min"
                subtext="-1.2 min from yesterday"
                icon={Clock}
                trend="down"
                trendValue="-1.2 min from yesterday"
                variant="purple"
            />
        </div>
    )
}
