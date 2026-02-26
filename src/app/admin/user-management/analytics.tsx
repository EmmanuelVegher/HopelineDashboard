
"use client"

import { useMemo } from "react"
import { Pie, PieChart, Cell, Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { type AdminUser, type Driver } from "@/lib/data"
import { useTranslation } from "react-i18next"

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const userRoleConfig = {
    count: {
        label: "User Count",
    },
} satisfies ChartConfig

export function UserRoleDistributionChart({ users, drivers }: { users: AdminUser[], drivers: Driver[] }) {
    const { t } = useTranslation();
    const data = useMemo(() => {
        const roleCounts: { [key: string]: number } = {};

        users.forEach(user => {
            const role = user.role?.toLowerCase() || 'user';
            roleCounts[role] = (roleCounts[role] || 0) + 1;
        });

        if (drivers && drivers.length > 0) {
            roleCounts['driver'] = (roleCounts['driver'] || 0) + drivers.length;
        }

        return Object.entries(roleCounts).map(([name, count]) => ({
            name: name === 'displaced_person' ? 'Beneficiary' : name.charAt(0).toUpperCase() + name.slice(1),
            count
        }));
    }, [users, drivers]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>{t("admin.userManagement.charts.roleDistribution")}</CardTitle>
                <CardDescription>{t("admin.userManagement.charts.roleDistributionDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer config={userRoleConfig} className="mx-auto aspect-square h-[300px]">
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={60}
                            strokeWidth={5}
                            label={(entry) => `${((entry.value / total) * 100).toFixed(0)}%`}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

export function RegistrationTrendChart({ users }: { users: AdminUser[] }) {
    const { t } = useTranslation();
    const data = useMemo(() => {
        // This is a dummy trend since we might not have createdAt for all users
        // If we had createdAt, we'd use it. For now, let's pretend or use profile completion as a dummy axis
        // Actually, let's just group by profile completion ranges to show "Engagement"
        const ranges = ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"];
        const counts = [0, 0, 0, 0, 0];

        users.forEach(user => {
            const completion = user.profileCompleted || 0;
            const index = Math.min(Math.floor(completion / 20), 4);
            counts[index]++;
        });

        return ranges.map((range, i) => ({ range, users: counts[i] }));
    }, [users]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("admin.userManagement.charts.profileCompletion")}</CardTitle>
                <CardDescription>{t("admin.userManagement.charts.profileCompletionDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={{ users: { label: "Users", color: "hsl(var(--chart-1))" } }} className="h-[300px] w-full">
                    <BarChart data={data}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="range" axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis axisLine={false} tickLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                            dataKey="users"
                            fill="var(--color-users)"
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

export function UserStatusAnalytics({ users }: { users: AdminUser[] }) {
    const { t } = useTranslation();
    const stats = useMemo(() => {
        const active = users.filter(u => u.accountStatus?.toLowerCase() === 'active').length;
        const inactive = users.length - active;
        return [
            { name: t("admin.userManagement.charts.active"), count: active },
            { name: t("admin.userManagement.charts.inactive"), count: inactive }
        ];
    }, [users, t]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("admin.userManagement.charts.accountStatus")}</CardTitle>
                <CardDescription>{t("admin.userManagement.charts.accountStatusDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-around items-center h-[200px]">
                    {stats.map((stat) => (
                        <div key={stat.name} className="text-center">
                            <div className={stat.name === t("admin.userManagement.charts.active") ? "text-4xl font-bold text-green-600" : "text-4xl font-bold text-gray-400"}>
                                {stat.count}
                            </div>
                            <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mt-2">
                                {stat.name}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
