import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { AuthLayout } from "./AuthLayout";

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const { applyTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    if (!accessToken || !refreshToken) {
      setError(true);
      return;
    }
    applyTokens(accessToken, refreshToken)
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError(true));
  }, [applyTokens, navigate, searchParams]);

  return (
    <AuthLayout title={error ? "Something went wrong" : "Signing you in…"}>
      <p className="text-center text-sm text-muted-foreground">
        {error ? "Google sign-in failed. Please try again." : "Just a moment."}
      </p>
    </AuthLayout>
  );
}
