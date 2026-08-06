import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAdminUsers, useSuspendUser, useReinstateUser } from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminUsers(search);
  const suspend = useSuspendUser();
  const reinstate = useReinstateUser();

  const handleToggle = async (userId: string, status: string) => {
    try {
      if (status === "suspended") {
        await reinstate.mutateAsync(userId);
        toast.success("User reinstated");
      } else {
        await suspend.mutateAsync(userId);
        toast.success("User suspended");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading && <Skeleton className="h-64" />}

      {data && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link to={`/admin/users/${user.id}`} className="font-medium text-primary hover:underline">
                      {user.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.kycStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "suspended" ? "destructive" : "outline"}>{user.status}</Badge>
                  </TableCell>
                  <TableCell>{user.ratingCount > 0 ? `★ ${user.ratingAvg.toFixed(1)}` : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => handleToggle(user.id, user.status)}>
                      {user.status === "suspended" ? "Reinstate" : "Suspend"}
                    </Button>
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
