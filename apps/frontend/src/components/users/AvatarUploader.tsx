import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { PHOTO_SIZES } from "@/lib/compress-photo";
import { UnreadablePhotoError, uploadPhoto } from "@/lib/upload-photo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

export function AvatarUploader({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | null | undefined;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadPhoto(file, PHOTO_SIZES.avatar));
    } catch (err) {
      const message = err instanceof ApiError || err instanceof UnreadablePhotoError ? err.message : null;
      toast.error(message ?? "Couldn't upload that photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="Change profile photo"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative h-20 w-20 shrink-0 rounded-full disabled:opacity-60"
      >
        <Avatar className="h-20 w-20">
          <AvatarImage src={value ?? undefined} />
          <AvatarFallback className="text-lg">{initials(name || "?")}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition group-hover:bg-black/40 group-hover:text-white">
          <Camera className="h-5 w-5" />
        </span>
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Change photo"}
        </button>
        <p className="text-xs text-muted-foreground">JPG or PNG, square photos look best.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
    </div>
  );
}
