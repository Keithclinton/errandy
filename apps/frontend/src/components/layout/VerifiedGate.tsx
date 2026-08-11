import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VerifiedGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.kycStatus === "verified") return <>{children}</>;

  return (
    <Card className="border-primary/30 bg-secondary">
      <CardHeader>
        <ShieldCheck className="mb-1 h-8 w-8 text-primary" />
        <CardTitle>Verify your identity to continue</CardTitle>
        <CardDescription>
          {user?.kycStatus === "pending"
            ? "Your verification is being reviewed. This usually only takes a moment — check back shortly."
            : "Errandspot requires a one-time ID + selfie check before you can post or bid, to keep the marketplace safe."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild disabled={user?.kycStatus === "pending"}>
          <Link to="/verify">{user?.kycStatus === "pending" ? "Verification pending" : "Start verification"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
