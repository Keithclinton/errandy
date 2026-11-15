import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import {
  canManageAccount,
  useAdminUserDetail,
  useSetAdminAccess,
  useSuspendUser,
  useReinstateUser,
  useSetUserKycStatus,
} from "@/hooks/use-admin";
import { ID_DOCUMENT_LABELS, type KycStatus } from "@/types/api";
import { ApiError } from "@/lib/api-client";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatListingStatus, formatMoney, formatRelativeTime } from "@/lib/format";

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const { data: user, isLoading } = useAdminUserDetail(id);
  const suspend = useSuspendUser();
  const reinstate = useReinstateUser();
  const setKycStatus = useSetUserKycStatus();
  const setAdminAccess = useSetAdminAccess();

  if (isLoading || !user || !me) return <Skeleton className="h-64" />;

  const canManage = canManageAccount(me, user);
  const canChangeAdminAccess = me.isSuperAdmin && user.id !== me.id && !user.isSuperAdmin;
  const idCheckStatus: KycStatus = user.idVerifiedAt ? "verified" : (user.idVerifications[0]?.status ?? "none");

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

  const handleSetKyc = async (status: KycStatus) => {
    try {
      await setKycStatus.mutateAsync({ userId: user.id, status });
      toast.success(`Phone verification set to ${status}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  const handleAdminAccess = async () => {
    try {
      await setAdminAccess.mutateAsync({ userId: user.id, isAdmin: !user.isAdmin });
      toast.success(user.isAdmin ? `${user.name} is no longer an admin` : `${user.name} is now an admin`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  const protectedReason = user.id === me.id
    ? "This is your account."
    : user.isSuperAdmin
      ? "The super admin account can't be suspended or deleted."
      : user.isAdmin && !me.isSuperAdmin
        ? "Only the super admin can suspend or delete an admin."
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">Phone: {user.kycStatus}</Badge>
            <Badge variant="secondary">ID: {idCheckStatus}</Badge>
            <Badge variant={user.status === "suspended" ? "destructive" : "outline"}>{user.status}</Badge>
            {user.isSuperAdmin ? <Badge>super admin</Badge> : user.isAdmin && <Badge>admin</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {(["verified", "rejected", "none"] as const)
              .filter((status) => status !== user.kycStatus)
              .map((status) => (
                <Button key={status} size="sm" variant="outline" onClick={() => handleSetKyc(status)}>
                  Set phone: {status}
                </Button>
              ))}
          </div>
          {canChangeAdminAccess && (
            <Button variant="outline" onClick={handleAdminAccess} disabled={setAdminAccess.isPending}>
              {user.isAdmin ? "Remove admin" : "Make admin"}
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={handleToggle}>
                {user.status === "suspended" ? "Reinstate" : "Suspend"}
              </Button>
              <DeleteUserDialog userId={user.id} email={user.email} />
            </>
          )}
          {protectedReason && <p className="max-w-xs text-right text-xs text-muted-foreground">{protectedReason}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks ({user.listings.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.listings.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {user.listings.map((listing) => (
              <Link key={listing.id} to={`/listings/${listing.id}`} className="block text-sm hover:underline">
                {listing.title} <span className="text-muted-foreground">· {formatListingStatus(listing.status)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offers ({user.bids.length})</CardTitle>
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
            <CardTitle className="text-base">ID checks ({user.idVerifications.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.idVerifications.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {user.idVerifications.map((check) => (
              <Link key={check.id} to={`/admin/id-checks/${check.id}`} className="block text-sm hover:underline">
                {ID_DOCUMENT_LABELS[check.documentType]} · {check.status}{" "}
                <span className="text-muted-foreground">· {formatRelativeTime(check.createdAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phone verifications ({user.kycVerifications.length})</CardTitle>
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
