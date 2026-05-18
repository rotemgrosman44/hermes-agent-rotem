import { Typography } from "@/components/NouiTypography";
import { useSidebarStatus } from "@/hooks/useSidebarStatus";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export function SidebarFooter({ collapsed = false }: SidebarFooterProps) {
  const status = useSidebarStatus();
  const { t } = useI18n();
  const version = status?.version != null ? `v${status.version}` : "—";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2",
        collapsed ? "justify-center px-2 py-2.5" : "justify-between px-5 py-2.5",
        "border-t border-current/10",
      )}
    >
      <Typography
        mondwest
        className={cn(
          "font-mono-ui text-[0.7rem] tabular-nums tracking-[0.1em] text-muted-foreground/70 lowercase",
          collapsed && "max-w-full truncate text-[0.6rem]",
        )}
        title={version}
      >
        {version}
      </Typography>

      {!collapsed && (
        <a
          href="https://nousresearch.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "font-mondwest text-[0.65rem] tracking-[0.15em] text-midground",
            "transition-opacity hover:opacity-90",
            "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/40",
          )}
          style={{ mixBlendMode: "plus-lighter" }}
        >
          {t.app.footer.org}
        </a>
      )}
    </div>
  );
}

interface SidebarFooterProps {
  collapsed?: boolean;
}
