import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { consumeResumePath } from "@/lib/auth-resume";
import { AuthLayout } from "./AuthLayout";

export default function GoogleCallback() {
  const location = useLocation();
  const { applyTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Tokens arrive in the URL fragment (#accessToken=...), not the query string,
    // so they're never sent to a server or logged anywhere along the redirect.
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    if (!accessToken || !refreshToken) {
      setError(true);
      return;
    }
    applyTokens(accessToken, refreshToken)
      .then(() => {
        const resumePath = consumeResumePath();
        navigate(resumePath ?? "/browse", { replace: true });
      })
      .catch(() => setError(true));
  }, [applyTokens, navigate, location.hash]);

  return (
    <AuthLayout title={error ? "Something went wrong" : "Signing you in…"}>
      <p className="text-center text-sm text-muted-foreground">
        {error ? "Google sign-in failed. Please try again." : "Just a moment."}
      </p>
    </AuthLayout>
  );
}
