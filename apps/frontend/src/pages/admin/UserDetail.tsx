import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAdminUserDetail, useSuspendUser, useReinstateUser } from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatRelativeTime } from "@/lib/format";

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useAdminUserDetail(id);
  const suspend = useSuspendUser();
  const reinstate = useReinstateUser();

  if (isLoading || !user) return <Skeleton className="h-64" />;

  const handleToggle = async () => {
    try {
      if (user.status === "suspended") {
        await reinstate.mutateAsync(user.id);
        toast.success("User reinstated");
      } else {
        await suspend.mutateAsync(user.id);
        toast.success("User suspended");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex gap-2">
            <Badge variant="secondary">KYC: {user.kycStatus}</Badge>
            <Badge variant={user.status === "suspended" ? "destructive" : "outline"}>{user.status}</Badge>
            {user.isAdmin && <Badge>admin</Badge>}
          </div>
        </div>
        <Button variant="outline" onClick={handleToggle}>
          {user.status === "suspended" ? "Reinstate" : "Suspend"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listings ({user.listings.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.listings.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {user.listings.map((listing) => (
              <Link key={listing.id} to={`/listings/${listing.id}`} className="block text-sm hover:underline">
                {listing.title} <span className="text-muted-foreground">· {listing.status}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bids ({user.bids.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.bids.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {user.bids.map((bid) => (
              <p key={bid.id} className="text-sm">
                {formatMoney(bid.amount)} <span className="text-muted-foreground">· {bid.status}</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">KYC verifications ({user.kycVerifications.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.kycVerifications.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {user.kycVerifications.map((kyc) => (
              <p key={kyc.id} className="text-sm">
                {kyc.status} <span className="text-muted-foreground">· {formatRelativeTime(kyc.consentAt)}</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reports filed ({user.reportsFiled.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.reportsFiled.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {user.reportsFiled.map((report) => (
              <p key={report.id} className="text-sm">
                {report.reason} <span className="text-muted-foreground">· {report.status}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
