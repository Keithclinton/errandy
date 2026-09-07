import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draft-storage";
import { setResumePath } from "@/lib/auth-resume";

interface Options<T> {
  draftKey: string;
  resumePath: string;
  onSubmit: (values: T) => Promise<void>;
}

/**
 * Lets a guest fill out a form and only gates at submit time: not logged in -> save the
 * draft and send them to register; logged in but not phone-verified -> save the draft and
 * send them to verify. Either way they land back on `resumePath` with the draft restored,
 * and click submit themselves again — no auto-submit, since a token gets spent for real at
 * that point and shouldn't happen as a surprise.
 *
 * Call this before any `useForm(...)` in the same component that needs `draft` for its
 * `defaultValues` — the initial value is read synchronously on the first render.
 */
export function useDraftGatedSubmit<T>({ draftKey, resumePath, onSubmit }: Options<T>) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const draftRef = useRef(loadDraft<T>(draftKey));

  const submit = useCallback(
    async (values: T) => {
      if (!user) {
        saveDraft(draftKey, values, resumePath);
        setResumePath(resumePath);
        navigate("/register", { state: { from: { pathname: resumePath } } });
        return;
      }
      if (user.kycStatus !== "verified") {
        saveDraft(draftKey, values, resumePath);
        setResumePath(resumePath);
        navigate("/verify", { state: { from: { pathname: resumePath } } });
        return;
      }
      await onSubmit(values);
      clearDraft(draftKey);
    },
    [user, draftKey, resumePath, navigate, onSubmit],
  );

  return { draft: draftRef.current?.values ?? null, submit };
}
