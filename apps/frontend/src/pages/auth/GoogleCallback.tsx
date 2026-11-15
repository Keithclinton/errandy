import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { consumeResumePath } from "@/lib/auth-resume";
import { AuthLayout } from "./AuthLayout";

const GENERIC_ERROR = "Google sign-in failed. Please try again.";

export default function GoogleCallback() {
  const location = useLocation();
  const { applyTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Tokens arrive in the URL fragment (#accessToken=...), not the query string,
    // so they're never sent to a server or logged anywhere along the redirect.
    // When sign-in is refused (say, the account was deleted recently), the reason comes the same way.
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const reason = params.get("error");
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    if (reason || !accessToken || !refreshToken) {
      setError(reason || GENERIC_ERROR);
      return;
    }
    applyTokens(accessToken, refreshToken)
      .then(() => {
        const resumePath = consumeResumePath();
        navigate(resumePath ?? "/browse", { replace: true });
      })
      .catch(() => setError(GENERIC_ERROR));
  }, [applyTokens, navigate, location.hash]);

  return (
    <AuthLayout title={error ? "Couldn't sign you in" : "Signing you in…"}>
      <p className="text-center text-sm text-muted-foreground">{error ?? "Just a moment."}</p>
      {error && (
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary underline underline-offset-4">
            Back to log in
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
