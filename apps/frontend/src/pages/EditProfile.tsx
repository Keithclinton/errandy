import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useUpdateProfile } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { ImageUploader } from "@/components/listings/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface FormValues {
  name: string;
  bio: string;
}

export default function EditProfile() {
  const { user, refetchUser } = useAuth();
  const updateProfile = useUpdateProfile();
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: "", bio: "" } });

  useEffect(() => {
    if (user) {
      reset({ name: user.name, bio: user.bio ?? "" });
      setPortfolioUrls(user.portfolioUrls ?? []);
    }
  }, [user, reset]);

  if (!user) return null;

  const onSubmit = async (values: FormValues) => {
    try {
      await updateProfile.mutateAsync({ name: values.name, bio: values.bio, portfolioUrls });
      await refetchUser();
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update your profile.");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit profile</h1>
        <p className="text-sm text-muted-foreground">
          Add a bio and a few portfolio photos so people know what you're good at.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register("name", { required: "Name is required" })} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={4}
            maxLength={500}
            placeholder="e.g. Graphic designer with 5 years of experience in branding and logos."
            {...register("bio")}
          />
        </div>

        <div className="space-y-2">
          <Label>Portfolio</Label>
          <ImageUploader
            value={portfolioUrls}
            onChange={setPortfolioUrls}
            uploadUrlEndpoint="/users/me/upload-url"
            maxImages={6}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
