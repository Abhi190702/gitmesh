import { cn } from "../lib/utils";

interface OpenCodeLogoIconProps {
  className?: string;
}

/**
 * OpenCode logo icon that adapts to light/dark theme.
 */
export function OpenCodeLogoIcon({ className }: OpenCodeLogoIconProps) {
  return (
    <>
      <img
        src="/brands/opencode-logo-light-square.svg"
        alt="OpenCode logo"
        className={cn("block dark:hidden", className)}
        loading="lazy"
      />
      <img
        src="/brands/opencode-logo-dark-square.svg"
        alt="OpenCode logo"
        className={cn("hidden dark:block", className)}
        loading="lazy"
      />
    </>
  );
}
