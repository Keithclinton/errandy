import { useRef, useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { PHOTO_SIZES } from "@/lib/compress-photo";
import { UnreadablePhotoError, uploadPhoto } from "@/lib/upload-photo";

const DEFAULT_MAX_IMAGES = 8;

export function ImageUploader({
  value,
  onChange,
  maxImages = DEFAULT_MAX_IMAGES,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - value.length;
    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of selected) {
        uploaded.push(await uploadPhoto(file, PHOTO_SIZES.photo));
      }
    } catch (err) {
      const message = err instanceof ApiError || err instanceof UnreadablePhotoError ? err.message : null;
      toast.error(message ?? "Couldn't upload one or more photos.");
    } finally {
      // Keep the photos that made it, even if a later one failed.
      if (uploaded.length) onChange([...value, ...uploaded]);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative h-20 w-20">
            <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full rounded-md object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < maxImages && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">{uploading ? "Uploading…" : "Add photo"}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
