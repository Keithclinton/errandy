import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { useRequestOtp, useVerifyOtp } from "@/hooks/use-kyc";
import { ApiError } from "@/lib/api-client";
import { TERMS_VERSION } from "@/lib/constants";
import { peekResumePath, clearResumePath } from "@/lib/auth-resume";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordField } from "@/components/auth/PasswordField";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(9, "Enter a valid Kenyan phone number"),
  password: z.string().min(8, "At least 8 characters"),
  acceptedTerms: z
    .boolean()
    .refine((v) => v === true, { message: "You must accept the Terms and Privacy Policy" }),
});
type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register: registerUser, refetchUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"details" | "code">("details");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { acceptedTerms: false } });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await registerUser({ ...values, termsVersion: TERMS_VERSION });
      setPhone(values.phone);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  const handleResend = async () => {
    try {
      await requestOtp.mutateAsync(phone);
      toast.success("Code sent! Check your SMS.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't resend the code.");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOtp.mutateAsync({ phone, code });
      await refetchUser();
      clearResumePath();
      const from = (location.state as { from?: Location })?.from?.pathname ?? peekResumePath();
      navigate(from ?? "/browse", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That code didn't work.");
    }
  };

  if (step === "code") {
    return (
      <AuthLayout title="Verify your phone" description="One last step — confirm it's really you.">
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code we sent to <span className="font-medium text-foreground">{phone}</span>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.5em]"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={verifyOtp.isPending || code.length !== 6}>
            {verifyOtp.isPending ? "Verifying…" : "Verify"}
          </Button>
          <button
            type="button"
            onClick={handleResend}
            disabled={requestOtp.isPending}
            className="w-full text-center text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            {requestOtp.isPending ? "Sending…" : "Resend code"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      description="One account to post tasks, make offers, and chat."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="phone" type="tel" autoComplete="tel" placeholder="0712345678" className="pl-9" {...register("phone")} />
          </div>
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          registration={register("password")}
          error={errors.password?.message}
        />
        <div className="flex items-start gap-2">
          <Controller
            name="acceptedTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="acceptedTerms"
                className="mt-0.5"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="acceptedTerms" className="text-sm font-normal leading-snug">
            I agree to the{" "}
            <Link to="/terms" className="text-primary hover:underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline" target="_blank">
              Privacy Policy
            </Link>
          </Label>
        </div>
        {errors.acceptedTerms && <p className="text-sm text-destructive">{errors.acceptedTerms.message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
