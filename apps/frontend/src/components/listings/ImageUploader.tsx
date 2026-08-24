import { useRef, useState } from "react";
import { put } from "@vercel/blob/client";
import { X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";

const DEFAULT_MAX_IMAGES = 8;

export function ImageUploader({
  value,
  onChange,
  uploadUrlEndpoint = "/listings/upload-url",
  maxImages = DEFAULT_MAX_IMAGES,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  uploadUrlEndpoint?: string;
  maxImages?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - value.length;
    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const { clientToken, pathname } = await apiFetch<{ clientToken: string; pathname: string }>(
          uploadUrlEndpoint,
          { method: "POST", body: { filename: file.name, contentType: file.type } },
        );
        const blob = await put(pathname, file, { access: "public", token: clientToken, contentType: file.type });
        uploaded.push(blob.url);
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't upload one or more images.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div key={url} className="relative h-20 w-20">
            <img src={url} alt="" className="h-full w-full rounded-md object-cover" />
            <button
              type="button"
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
