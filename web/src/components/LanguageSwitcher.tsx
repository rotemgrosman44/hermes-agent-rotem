import { Button } from "@nous-research/ui/ui/components/button";
import { Typography } from "@/components/NouiTypography";
import { useI18n } from "@/i18n/context";
import { cn } from "@/lib/utils";

/**
 * Compact language toggle — shows a clickable flag that switches between
 * English and Chinese.  Persists choice to localStorage.
 */
export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  const toggle = () => setLocale(locale === "en" ? "zh" : "en");

  return (
    <Button
      ghost
      onClick={toggle}
      title={t.language.switchTo}
      aria-label={t.language.switchTo}
      className={cn(
        "normal-case tracking-normal font-normal text-xs text-muted-foreground hover:text-foreground",
        compact ? "px-1.5 py-1" : "px-2 py-1",
      )}
    >
      <span className={cn("inline-flex items-center", compact ? "gap-0" : "gap-1.5")}>
        <span className="text-base leading-none">
          {locale === "en" ? "🇬🇧" : "🇨🇳"}
        </span>

        <Typography
          mondwest
          className={cn(
            "hidden tracking-wide uppercase text-[0.65rem]",
            !compact && "sm:inline",
          )}
        >
          {locale === "en" ? "EN" : "中文"}
        </Typography>
      </span>
    </Button>
  );
}

interface LanguageSwitcherProps {
  compact?: boolean;
}
