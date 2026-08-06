import { useState } from "react";
import { toast } from "sonner";
import { useAdminReports, useResolveReport } from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/format";
import type { ReportStatus } from "@/types/api";

export default function AdminReports() {
  const [status, setStatus] = useState<ReportStatus | "all">("open");
  const { data, isLoading } = useAdminReports(status === "all" ? undefined : status);
  const resolveReport = useResolveReport();

  const handleResolve = async (id: string, next: "actioned" | "dismissed") => {
    try {
      await resolveReport.mutateAsync({ id, status: next });
      toast.success(next === "actioned" ? "Report actioned" : "Report dismissed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Select value={status} onValueChange={(v) => setStatus(v as ReportStatus | "all")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <Skeleton className="h-48" />}

      {data && data.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No reports here.</p>}

      <div className="space-y-3">
        {data?.map((report) => (
          <Card key={report.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{report.targetType}</Badge>
                  <Badge variant="outline">{report.reason}</Badge>
                  <Badge>{report.status}</Badge>
                </div>
                {report.details && <p className="mt-1 text-sm">{report.details}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Target: {report.targetId} · {formatRelativeTime(report.createdAt)}
                </p>
              </div>
              {report.status === "open" && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => handleResolve(report.id, "actioned")}>
                    Action
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleResolve(report.id, "dismissed")}>
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
