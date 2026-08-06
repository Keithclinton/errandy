import { useId, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function PasswordField({
  id,
  label,
  labelExtra,
  error,
  registration,
  autoComplete,
}: {
  id: string;
  label: React.ReactNode;
  labelExtra?: React.ReactNode;
  error?: string;
  registration: UseFormRegisterReturn;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const showId = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelExtra}
      </div>
      <Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} {...registration} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Checkbox id={showId} checked={visible} onCheckedChange={(checked) => setVisible(checked === true)} />
        <Label htmlFor={showId} className="text-xs font-normal text-muted-foreground">
          Show password
        </Label>
      </div>
    </div>
  );
}
