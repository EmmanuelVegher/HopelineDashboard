
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, Area, AreaChart, Tooltip as RechartsTooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { type SosAlert } from "@/ai/schemas/sos"
import { type DisplacedPerson } from "@/lib/data"
import { useMemo } from "react"
import { type Shelter } from "@/lib/data"


const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

// Alerts Over Time Chart
const alertsChartConfig = {
  alerts: {
    label: "Alerts",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function AlertsOverTimeChart({ alerts }: { alerts: SosAlert[] }) {
    const data = useMemo(() => {
        const dailyAlerts: { [key: string]: number } = {};
        if (!alerts) return [];
        alerts.forEach(alert => {
            if (alert.timestamp?.toDate) {
                const dateObj = alert.timestamp.toDate();
                const date = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
                dailyAlerts[date] = (dailyAlerts[date] || 0) + 1;
            }
        });
        return Object.entries(dailyAlerts).map(([date, count]) => ({ date, alerts: count })).sort((a,b) => a.date.localeCompare(b.date));
    }, [alerts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SOS Alerts Over Time</CardTitle>
        <CardDescription>Daily count of incoming emergency alerts.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={alertsChartConfig} className="h-[250px] w-full">
            <AreaChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
                 <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}/>
                 <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Area dataKey="alerts" type="natural" fill="var(--color-alerts)" fillOpacity={0.4} stroke="var(--color-alerts)" />
            </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}


// Shelter Occupancy Chart
const shelterChartConfig = {
  occupied: {
    label: "Occupied",
    color: "hsl(var(--chart-1))",
  },
  available: {
    label: "Available",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ShelterOccupancyChart({ shelters }: { shelters: Shelter[]}) {
    const data = (shelters || []).map(s => ({
        name: s.name.split(" ")[0], // Shorten name for chart
        occupied: s.capacity - s.availableCapacity,
        available: s.availableCapacity,
    })).slice(0, 5); // show top 5

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shelter Occupancy Overview</CardTitle>
        <CardDescription>Current occupancy rates for key shelters.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={shelterChartConfig} className="h-[250px] w-full">
          <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" dataKey="occupied" hide/>
            <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} width={80} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="occupied" stackId="a" fill="var(--color-occupied)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="available" stackId="a" fill="var(--color-available)" radius={[4, 0, 0, 4]}/>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}


// Emergency Types Chart
const emergencyTypesChartConfig = {
  count: {
    label: "Count",
  },
} satisfies ChartConfig

export function EmergencyTypesChart({ alerts }: { alerts: SosAlert[] }) {
    const data = useMemo(() => {
        const typeCounts: { [key: string]: number } = {};
        if (!alerts) return [];
        alerts.forEach(alert => {
            typeCounts[alert.emergencyType] = (typeCounts[alert.emergencyType] || 0) + 1;
        });
        return Object.entries(typeCounts).map(([name, count]) => ({ name, count }));
    }, [alerts]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Emergency Types</CardTitle>
                <CardDescription>Breakdown of alert types received.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer config={emergencyTypesChartConfig} className="mx-auto aspect-square h-[250px]">
                    <PieChart>
                         <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie data={data} dataKey="count" nameKey="name" innerRadius={60} strokeWidth={5} label={(entry) => `${((entry.value / total) * 100).toFixed(1)}%`}>
                              {data.map((_, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                         </Pie>
                         <ChartLegend content={<ChartLegendContent nameKey="name" />} className="flex-col gap-2 items-start" />
                    </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4">
                    {data.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-sm">{item.name}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}


// Displaced Persons Status Chart
const personStatusChartConfig = {
  count: {
    label: "Count",
  },
} satisfies ChartConfig

export function DisplacedPersonsStatusChart({ persons }: { persons: DisplacedPerson[] }) {
    const data = useMemo(() => {
        const statusCounts: { [key: string]: number } = {};
        if (!persons) return [];
        persons.forEach(person => {
            statusCounts[person.status] = (statusCounts[person.status] || 0) + 1;
        });
        return Object.entries(statusCounts).map(([name, count]) => ({ name, count }));
    }, [persons]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Displaced Persons Status</CardTitle>
                <CardDescription>Current status of all tracked individuals.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer config={personStatusChartConfig} className="mx-auto aspect-square h-[250px]">
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie data={data} dataKey="count" nameKey="name" innerRadius={60} outerRadius={80} startAngle={90} endAngle={450} label={(entry) => `${((entry.value / total) * 100).toFixed(1)}%`}>
                              {data.map((_, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                         </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} className="flex-col gap-2 items-start" />
                    </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4">
                    {data.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-sm">{item.name}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
