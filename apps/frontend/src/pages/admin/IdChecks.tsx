import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminIdChecks, type IdCheckFilter } from "@/hooks/use-admin";
import { formatRelativeTime } from "@/lib/format";
import { ID_DOCUMENT_LABELS } from "@/types/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPTY_MESSAGES: Record<IdCheckFilter, string> = {
  pending: "No ID checks waiting. You're all caught up.",
  verified: "No approved ID checks yet.",
  rejected: "No rejected ID checks.",
};

export default function AdminIdChecks() {
  const [status, setStatus] = useState<IdCheckFilter>("pending");
  const { data, isLoading } = useAdminIdChecks(status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ID checks</h1>
          <p className="text-sm text-muted-foreground">
            Compare each ID with the selfie and the account name, then approve or reject it. The photos are deleted
            once you decide.
          </p>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as IdCheckFilter)}>
          <SelectTrigger className="w-40" aria-label="Filter ID checks by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Waiting</SelectItem>
            <SelectItem value="verified">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <Skeleton className="h-48" />}

      {data && data.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{EMPTY_MESSAGES[status]}</p>
      )}

      {data && data.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Name on document</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>{status === "pending" ? "Sent" : "Reviewed"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((check) => (
                <TableRow key={check.id}>
                  <TableCell>
                    <Link to={`/admin/id-checks/${check.id}`} className="font-medium text-primary hover:underline">
                      {check.user.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{check.user.email}</p>
                  </TableCell>
                  <TableCell>{check.fullName}</TableCell>
                  <TableCell>{ID_DOCUMENT_LABELS[check.documentType]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(status === "pending" ? check.createdAt : (check.reviewedAt ?? check.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
