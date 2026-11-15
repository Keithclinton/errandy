import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ImageIcon, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSubmitIdCheck } from "@/hooks/use-kyc";
import { ApiError } from "@/lib/api-client";
import { compressPhoto } from "@/lib/compress-photo";
import { formatRelativeTime } from "@/lib/format";
import { ID_DOCUMENT_LABELS, type IdDocumentType, type OwnIdCheck } from "@/types/api";
import { IdVerifiedBadge } from "@/components/users/IdVerifiedBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ID_NUMBER_PATTERN = /^[A-Za-z0-9 -]{5,24}$/;

function PhotoField({
  label,
  hint,
  value,
  onChange,
  capture,
}: {
  label: string;
  hint: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  capture?: "user" | "environment";
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      onChange(await compressPhoto(file));
    } catch {
      toast.error("We couldn't read that photo. Try again with a JPG or PNG.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {value ? (
          <img src={value} alt={`${label}, as you'll send it`} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <p id={`${id}-label`} className="text-sm font-medium">
          {label}
        </p>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
        <Button
          id={`${id}-button`}
          type="button"
          variant="outline"
          size="sm"
          disabled={preparing}
          aria-labelledby={`${id}-label ${id}-button`}
          aria-describedby={`${id}-hint`}
          onClick={() => inputRef.current?.click()}
        >
          {preparing ? "Preparing…" : value ? "Change photo" : "Add photo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture={capture}
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

function IdCheckForm() {
  const submit = useSubmitIdCheck();
  const [documentType, setDocumentType] = useState<IdDocumentType>("national_id");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [photos, setPhotos] = useState<{ front?: string; back?: string; selfie?: string }>({});
  const [consent, setConsent] = useState(false);

  const isPassport = documentType === "passport";
  const ready =
    fullName.trim().length >= 3 &&
    ID_NUMBER_PATTERN.test(idNumber.trim()) &&
    !!photos.front &&
    (isPassport || !!photos.back) &&
    !!photos.selfie &&
    consent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !photos.front || !photos.selfie) return;
    try {
      await submit.mutateAsync({
        documentType,
        fullName: fullName.trim(),
        idNumber: idNumber.trim(),
        consent,
        images: { front: photos.front, back: isPassport ? undefined : photos.back, selfie: photos.selfie },
      });
      toast.success("Sent! We'll let you know once your ID has been checked.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 413) {
        toast.error("Those photos are too large to send. Take them again, a little further away.");
      } else if (err instanceof ApiError && err.status === 429) {
        toast.error("Too many attempts. Please try again in an hour.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Couldn't send your ID. Try again.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="id-document-type">Document</Label>
        <Select value={documentType} onValueChange={(value) => setDocumentType(value as IdDocumentType)}>
          <SelectTrigger id="id-document-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ID_DOCUMENT_LABELS) as IdDocumentType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {ID_DOCUMENT_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="id-full-name">Full name, as written on it</Label>
        <Input id="id-full-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="id-number">{isPassport ? "Passport number" : "ID number"}</Label>
        <Input
          id="id-number"
          autoComplete="off"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          aria-invalid={idNumber.trim() !== "" && !ID_NUMBER_PATTERN.test(idNumber.trim())}
        />
      </div>

      <PhotoField
        label={isPassport ? "Passport photo page" : "Front of your ID"}
        hint="Lay it flat in good light so every word can be read."
        value={photos.front}
        onChange={(front) => setPhotos((p) => ({ ...p, front }))}
      />
      {!isPassport && (
        <PhotoField
          label="Back of your ID"
          hint="The same way, showing the whole back."
          value={photos.back}
          onChange={(back) => setPhotos((p) => ({ ...p, back }))}
        />
      )}
      <PhotoField
        label="A selfie"
        hint="Face the camera in good light, without sunglasses or a hat."
        value={photos.selfie}
        onChange={(selfie) => setPhotos((p) => ({ ...p, selfie }))}
        capture="user"
      />

      <div className="flex items-start gap-2">
        <Checkbox
          id="id-consent"
          className="mt-0.5"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
        />
        <Label htmlFor="id-consent" className="text-sm font-normal leading-snug">
          I agree to Errandspot checking these photos to confirm who I am. They're deleted once they've been
          checked. See our{" "}
          <Link to="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={!ready || submit.isPending}>
        {submit.isPending ? "Sending…" : "Send for checking"}
      </Button>
    </form>
  );
}

export function IdCheckSection({ phoneVerified, idCheck }: { phoneVerified: boolean; idCheck: OwnIdCheck }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">ID check</CardTitle>
        <CardDescription>
          Optional. Adds an ID verified badge to your profile, tasks and offers, so people know who they're dealing
          with. An Errandspot admin checks every ID by hand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {idCheck.status === "verified" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <IdVerifiedBadge className="text-sm" />
            <p className="text-sm text-muted-foreground">Your ID is verified. Everyone sees the badge on your profile.</p>
          </div>
        )}

        {idCheck.status === "pending" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Clock className="h-8 w-8 text-primary" aria-hidden />
            <p className="font-medium">We're checking your ID</p>
            <p className="text-sm text-muted-foreground">
              Sent {idCheck.submittedAt ? formatRelativeTime(idCheck.submittedAt) : "recently"}. You'll get a
              notification as soon as an admin has looked at it.
            </p>
          </div>
        )}

        {(idCheck.status === "none" || idCheck.status === "rejected") &&
          (phoneVerified ? (
            <>
              {idCheck.status === "rejected" && (
                <div className="flex gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="font-medium">Your last ID check wasn't approved</p>
                    {idCheck.rejectionReason && <p className="text-muted-foreground">{idCheck.rejectionReason}</p>}
                    <p className="text-muted-foreground">You can send it again below.</p>
                  </div>
                </div>
              )}
              <IdCheckForm />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Verify your phone number above first.</p>
          ))}
      </CardContent>
    </Card>
  );
}
