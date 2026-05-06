import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type IdentitySize = "xs" | "sm" | "default" | "lg";

export interface IdentityProps {
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  size?: IdentitySize;
  className?: string;
}

/**
 * Derive 1-2 character initials from a full name.
 */
function makeInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const labelSize: Record<IdentitySize, string> = {
  xs: "text-xs",
  sm: "text-xs",
  default: "text-sm",
  lg: "text-sm font-medium",
};

/**
 * Avatar + name display for user/agent identities.
 */
export function Identity({ name, avatarUrl, initials, size = "default", className }: IdentityProps) {
  const letters = initials ?? makeInitials(name);

  return (
    <span
      className={cn(
        "inline-flex items-center",
        size === "xs" ? "gap-1" : size === "lg" ? "gap-2.5" : "gap-1.5",
        className,
      )}
    >
      <Avatar size={size}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback>{letters}</AvatarFallback>
      </Avatar>
      <span className={cn("truncate", labelSize[size])}>{name}</span>
    </span>
  );
}
