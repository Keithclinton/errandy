import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ArrowRight } from "lucide-react";
import {
  useAnalyticsBidsPerMonth,
  useAnalyticsTopCategories,
  useAnalyticsFunnel,
  useAnalyticsActiveUsers,
  useAnalyticsKycPassRate,
} from "@/hooks/use-admin";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_BLUE = "#0284c7";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminAnalytics() {
  const bidsPerMonth = useAnalyticsBidsPerMonth();
  const topCategories = useAnalyticsTopCategories();
  const funnel = useAnalyticsFunnel();
  const activeUsers = useAnalyticsActiveUsers();
  const kycPassRate = useAnalyticsKycPassRate();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Active users (30d)" value={activeUsers.data ? String(activeUsers.data.activeUsers) : "—"} />
        <StatTile
          label="KYC pass rate"
          value={
            kycPassRate.data?.passRate != null ? `${Math.round(kycPassRate.data.passRate * 100)}%` : "No data yet"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task → offer → chat funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {funnel.isLoading || !funnel.data ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <StatTile label="Tasks created" value={String(funnel.data.listingsCreated)} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <StatTile label="With an offer" value={String(funnel.data.listingsWithBids)} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <StatTile label="With a chat" value={String(funnel.data.listingsWithChat)} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offers per month</CardTitle>
          </CardHeader>
          <CardContent>
            {bidsPerMonth.isLoading || !bidsPerMonth.data ? (
              <Skeleton className="h-64" />
            ) : bidsPerMonth.data.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No offers yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={bidsPerMonth.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short" })}
                    tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    contentStyle={{ borderRadius: 8, borderColor: "hsl(214 32% 91%)", fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="count" name="Offers" stroke={CHART_BLUE} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top categories</CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.isLoading || !topCategories.data ? (
              <Skeleton className="h-64" />
            ) : topCategories.data.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCategories.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "hsl(214 32% 91%)", fontSize: 12 }} />
                  <Bar dataKey="count" name="Tasks" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
