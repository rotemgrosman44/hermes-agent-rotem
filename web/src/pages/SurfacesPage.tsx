import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type {
  SurfaceCard,
  SurfaceQuickPanel,
  SurfaceQuickPanelItem,
  SurfaceQuickPanelSection,
  SurfacesResponse,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BadgeVariant = "success" | "secondary" | "warning" | "destructive" | "outline";

const ROLE_STYLES: Record<
  string,
  {
    badgeClass: string;
    frameClass: string;
    accentClass: string;
  }
> = {
  Main: {
    badgeClass: "border-emerald-400/35 bg-emerald-950/70 text-emerald-200",
    frameClass: "border-emerald-400/25 shadow-[0_0_0_1px_rgba(74,222,128,0.15)]",
    accentClass: "text-emerald-100",
  },
  Operator: {
    badgeClass: "border-sky-400/35 bg-sky-950/65 text-sky-100",
    frameClass: "border-sky-400/25 shadow-[0_0_0_1px_rgba(56,189,248,0.14)]",
    accentClass: "text-sky-100",
  },
  External: {
    badgeClass: "border-slate-300/30 bg-slate-950/55 text-slate-100",
    frameClass: "border-slate-300/18 shadow-[0_0_0_1px_rgba(148,163,184,0.12)]",
    accentClass: "text-slate-100",
  },
};

const HUMAN_STATE_VARIANT: Record<string, BadgeVariant> = {
  Running: "success",
  "Needs Rotem": "warning",
  Blocked: "destructive",
  External: "secondary",
};

const HUMAN_STATE_COPY: Record<
  string,
  { he: string; helper: string; helperHe: string; lightClass: string; cardClass: string }
> = {
  Running: {
    he: "רצים עכשיו",
    helper: "Healthy and active",
    helperHe: "קו פעיל ובריא",
    lightClass: "bg-emerald-400",
    cardClass: "border-emerald-400/20 bg-emerald-500/8",
  },
  "Needs Rotem": {
    he: "נדרשת התערבותך",
    helper: "Human gate",
    helperHe: "נדרשת פעולה או החלטה שלך",
    lightClass: "bg-amber-300",
    cardClass: "border-amber-300/25 bg-amber-400/10",
  },
  Blocked: {
    he: "חסום",
    helper: "Needs recovery",
    helperHe: "יש תקלה או חסם",
    lightClass: "bg-rose-400",
    cardClass: "border-rose-400/25 bg-rose-500/10",
  },
  External: {
    he: "חיצוני",
    helper: "Separate lane",
    helperHe: "נשאר נפרד",
    lightClass: "bg-slate-300",
    cardClass: "border-slate-300/20 bg-slate-400/8",
  },
};

const ACTION_MODE_COPY: Record<string, { en: string; he: string; className: string }> = {
  technical: {
    en: "Technical intervention",
    he: "התערבות טכנית",
    className: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  },
  men_in_the_loop: {
    en: "Men in the loop",
    he: "החלטת אדם בלולאה",
    className: "border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100",
  },
  external: {
    en: "External lane",
    he: "משטח חיצוני",
    className: "border-slate-300/30 bg-slate-500/10 text-slate-100",
  },
};

function runtimeLabel(runtimeHome: string | undefined) {
  if (!runtimeHome) return "unknown";
  const segments = runtimeHome.split("/").filter(Boolean);
  return segments.at(-1) ?? runtimeHome;
}

function compactTechnicalValue(value: string) {
  if (value.length <= 56) return value;
  return `${value.slice(0, 26)}…${value.slice(-18)}`;
}

function SurfaceSectionTitle({ en, he }: { en: string; he: string }) {
  return (
    <div className="mb-2 text-right" dir="rtl">
      <div className="rotem-focus-section-title-he">{he}</div>
      <div className="rotem-focus-section-title-en">{en}</div>
    </div>
  );
}

function CompactTechnicalValue({
  value,
  note,
}: {
  value: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const compactValue = compactTechnicalValue(value);
  const displayValue = revealed ? value : compactValue;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const canReveal = compactValue !== value;

  return (
    <div className="rotem-focus-compact-shell">
      <code className="rotem-focus-compact-value font-mono-ui" dir="ltr" title={value}>
        {displayValue}
      </code>
      <div className="rotem-focus-compact-actions">
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </Button>
        {canReveal ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? "Hide" : "Reveal"}
          </Button>
        ) : null}
      </div>
      {note ? (
        <div className="rotem-focus-compact-note" dir="rtl">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function TrafficLegend({ cards }: { cards: SurfaceCard[] }) {
  const states = ["Running", "Needs Rotem", "Blocked", "External"] as const;
  const counts = states.reduce(
    (acc, state) => {
      acc[state] = cards.filter((card) => card.human_state === state).length;
      return acc;
    },
    {
      Running: 0,
      "Needs Rotem": 0,
      Blocked: 0,
      External: 0,
    } as Record<(typeof states)[number], number>,
  );

  return (
    <div className="rotem-focus-traffic-pad" role="presentation">
      {states.map((state, index) => {
        const meta = HUMAN_STATE_COPY[state];
        const count = counts[state];
        return (
          <div
            key={state}
            className={`rotem-focus-traffic-card rotem-focus-traffic-card--${index + 1} rotem-focus-traffic-card--${state
              .toLowerCase()
              .replace(/\s+/g, "-")} ${meta.cardClass} ${count > 0 ? "is-live" : ""}`}
          >
            <div className="rotem-focus-traffic-counter-shell">
              <span className={`rotem-focus-traffic-light ${meta.lightClass}`} />
              <div className="rotem-focus-traffic-counter">{count}</div>
              <div className="rotem-focus-traffic-counter-he" dir="rtl">
                {state === "Running" ? "קווים פעילים" : state === "Needs Rotem" ? "נקודות תשומת לב" : state === "Blocked" ? "חסימות" : "משטחים נפרדים"}
              </div>
            </div>
            <div className="min-w-0 rotem-focus-traffic-copy">
              <div className="rotem-focus-traffic-title-he" dir="rtl">
                {meta.he}
              </div>
              <div className="rotem-focus-traffic-helper-en">{state}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const QUICK_PANEL_SECTION_HELPERS: Record<string, { en: string; he: string }> = {
  "jarvis-laptop-access": {
    en: "Jarvis stays external. Use button 06 to open the SSH tunnel, and keep that terminal open while working.",
    he: "Jarvis נשאר חיצוני. פותחים דרך כפתור 06, ומשאירים את חלון ה־SSH tunnel פתוח בזמן העבודה.",
  },
  "mac-coordination": {
    en: "Use these files only through the bridge to ask Codex or Jarvis on the Mac to validate architecture. This is not a messaging lane.",
    he: "הקבצים כאן מיועדים רק לתיאום דרך ה־bridge מול Codex או Jarvis על המאק. זה לא ערוץ הודעות ולא מקום לכתוב ממנו ישירות אל Jarvis.",
  },
};

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-16 w-16" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M16.1 7.1a8.5 8.5 0 0 0-7.3 12.8l-1 3.7 3.8-1a8.5 8.5 0 1 0 4.5-15.5Zm0 1.7a6.8 6.8 0 0 1 5.8 10.4 6.8 6.8 0 0 1-8 2.7l-.4-.1-2.2.6.6-2.1-.2-.4a6.8 6.8 0 0 1 4.4-10.9Zm-3.2 3.6c-.2 0-.4 0-.6.4-.2.4-.8 1-.8 2.4s.9 2.8 1 3c.1.2 1.9 3 4.6 4 .6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1 .1-1.2-.1-.2-.3-.3-.6-.4l-1.6-.8c-.2-.1-.4-.1-.6.2l-.7.8c-.2.2-.4.2-.6.1-.2-.1-.9-.3-1.7-1.1-.7-.6-1.1-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5Z"
      />
    </svg>
  );
}

function TelegramMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-16 w-16" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#229ED9" />
      <path
        fill="#fff"
        d="m23.7 9.4-2.3 11c-.2.8-.7 1-1.4.6l-3.6-2.7-1.7 1.6c-.2.2-.4.4-.8.4l.3-3.7 6.8-6.1c.3-.3-.1-.4-.4-.2l-8.4 5.3-3.6-1.1c-.8-.2-.8-.8.2-1.2l14.2-5.5c.7-.2 1.2.2 1 .9Z"
      />
    </svg>
  );
}

function JarvisMark() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-slate-300/25 bg-[linear-gradient(180deg,rgba(203,213,225,0.16),rgba(30,41,59,0.55))] font-expanded text-lg font-bold tracking-[0.18em] text-slate-100">
      J
    </div>
  );
}

function BrandMark({ asset, role }: { asset: string | null; role: string }) {
  return (
    <div className="rotem-focus-mark">
      {asset === "whatsapp" ? <WhatsAppMark /> : null}
      {asset === "telegram" ? <TelegramMark /> : null}
      {asset === "jarvis" ? <JarvisMark /> : null}
      {!asset ? (
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-[20px] border border-border/70 bg-background/70 font-expanded text-sm font-bold uppercase ${
            ROLE_STYLES[role]?.accentClass ?? "text-foreground"
          }`}
        >
          {role.slice(0, 1)}
        </div>
      ) : null}
    </div>
  );
}

function CopyValueRow({ item }: { item: SurfaceQuickPanelItem }) {
  return (
    <div className="rotem-focus-quick-item">
      <div className="min-w-0 flex-1">
        <div className="rotem-focus-quick-title">{item.label}</div>
        <div className="rotem-focus-quick-title-he">{item.label_he}</div>
        <div className="mt-2">
          <CompactTechnicalValue value={item.value} note={item.note ?? undefined} />
        </div>
      </div>
    </div>
  );
}

function QuickPanelSection({ section }: { section: SurfaceQuickPanelSection }) {
  const helper = QUICK_PANEL_SECTION_HELPERS[section.id];
  return (
    <section className="rotem-focus-side-section">
      <SurfaceSectionTitle en={section.title} he={section.title_he} />
      {helper ? (
        <div className="rotem-focus-side-helper">
          <div>{helper.en}</div>
          <div className="rotem-focus-side-helper-he">{helper.he}</div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {section.items.map((item) => (
          <CopyValueRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function SummaryRunningCard({ card }: { card: SurfaceCard }) {
  return (
    <div className="rotem-focus-summary-row">
      <BrandMark asset={card.brand_asset} role={card.visual_role} />
      <div className="min-w-0 flex-1">
        <div className="rotem-focus-summary-row-he" dir="rtl">
          {card.visual_label_he}
        </div>
        <div className="rotem-focus-summary-row-title">{card.visual_label}</div>
      </div>
      <Badge variant="success">{card.human_state}</Badge>
    </div>
  );
}

function SummaryStatusTile({
  kicker,
  title,
  value,
  state,
  children,
}: {
  kicker: string;
  title: string;
  value: number | string;
  state: "Running" | "Needs Rotem" | "Blocked" | "External";
  children: ReactNode;
}) {
  const meta = HUMAN_STATE_COPY[state];
  return (
    <Card className={`rotem-focus-dashboard-tile rotem-focus-dashboard-tile--${state.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 text-right" dir="rtl">
            <div className="rotem-focus-kicker">{kicker}</div>
            <CardTitle className="rotem-focus-panel-title-he">{title}</CardTitle>
          </div>
          <div className="rotem-focus-tile-meter" aria-label={`${state}: ${value}`}>
            <span className={`rotem-focus-traffic-light ${meta.lightClass}`} />
            <span className="rotem-focus-tile-value">{value}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function SurfaceSummary({ cards }: { cards: SurfaceCard[] }) {
  const running = cards.filter((card) => card.human_state === "Running");
  const needsRotem = cards.filter((card) => card.human_state === "Needs Rotem");
  const externalCards = cards.filter(
    (card) => card.visual_role === "External" || card.human_state === "External",
  );

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <SummaryStatusTile kicker="Running now" title="כרגע פעיל" value={running.length} state="Running">
        <div className="flex flex-col gap-2">
          {running.map((card) => (
            <SummaryRunningCard key={card.id} card={card} />
          ))}
        </div>
      </SummaryStatusTile>

      <SummaryStatusTile
        kicker="Human in the loop"
        title="נדרשת התערבותך"
        value={needsRotem.length}
        state={needsRotem.length > 0 ? "Needs Rotem" : "Running"}
      >
        <div className="flex flex-col gap-2">
          {needsRotem.length > 0 ? (
            needsRotem.map((card) => (
              <div key={card.id} className="rotem-focus-alert-card">
                <div className="mb-1 rotem-focus-summary-row-he" dir="rtl">
                  {card.visual_label_he}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground" dir="rtl">
                  {card.needs_rotem_reason_he || card.needs_rotem_reason}
                </p>
              </div>
            ))
          ) : (
            <div className="rotem-focus-muted-card">
              <div className="rotem-focus-summary-row-he" dir="rtl">אין חסימה מיידית</div>
              <div className="text-sm text-muted-foreground">No blocking gate</div>
            </div>
          )}
        </div>
      </SummaryStatusTile>

      <SummaryStatusTile kicker="Boundary" title="נשאר נפרד" value={externalCards.length} state="External">
        <div className="flex flex-col gap-2">
          {externalCards.length > 0 ? (
            externalCards.map((card) => (
            <div key={card.id} className="rotem-focus-muted-card">
              <div className="rotem-focus-summary-row-he" dir="rtl">
                {card.visual_label_he}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">External</div>
            </div>
            ))
          ) : (
            <div className="rotem-focus-muted-card">
              <div className="text-sm text-muted-foreground" dir="rtl">אין משטח חיצוני נוסף</div>
            </div>
          )}
        </div>
      </SummaryStatusTile>
    </div>
  );
}

function SurfaceCardView({ card }: { card: SurfaceCard }) {
  const role = card.visual_role || "External";
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.External;
  const stateVariant = HUMAN_STATE_VARIANT[card.human_state] ?? "outline";
  const showPortalButton = Boolean(card.portal_url && role === "External" && card.portal_reachable !== false);

  return (
    <Card className={`rotem-focus-surface-card ${roleStyle.frameClass}`}>
      <CardHeader className="gap-4">
        <div className="flex items-start gap-4">
          <BrandMark asset={card.brand_asset} role={role} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={roleStyle.badgeClass}>
                {role}
              </Badge>
              <Badge variant={stateVariant}>{card.human_state}</Badge>
              {card.portal_reachable === false ? <Badge variant="destructive">Unavailable</Badge> : null}
            </div>
            <div className="rotem-focus-surface-title-he" dir="rtl">
              {card.visual_label_he}
            </div>
            <CardTitle className="rotem-focus-surface-title">{card.visual_label || card.label}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <section className="rotem-focus-section rotem-focus-section--action">
          <SurfaceSectionTitle en="Rotem action" he="איפה אתה מתערב" />
          <div className="mb-3 flex flex-wrap gap-2">
            {card.action_modes.map((mode) => {
              const copy = ACTION_MODE_COPY[mode];
              if (!copy) return null;
              return (
                <Badge key={mode} variant="outline" className={copy.className}>
                  {copy.en}
                </Badge>
              );
            })}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground" dir="rtl">
            {card.needs_rotem_reason_he || "כרגע אין דרישת התערבות ישירה בקו הזה."}
          </p>
          {card.portal_reachable === false ? (
            <div className="mt-3 rotem-focus-unavailable-note" dir="rtl">
              Jarvis חיצוני. פתח קודם את כפתור 06 בתיקיית HERMES ONBOARD והשאר את חלון ה־tunnel פתוח.
            </div>
          ) : null}
          {showPortalButton ? (
            <div className="mt-3">
              <a href={card.portal_url!} target="_blank" rel="noreferrer">
                <Button type="button" variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Jarvis Portal / פתח Jarvis
                </Button>
              </a>
            </div>
          ) : null}
        </section>

        <details className="rotem-focus-details">
          <summary>More details / פרטים טכניים</summary>
          <div className="mt-4 flex flex-col gap-4">
            <section className="rotem-focus-section">
              <SurfaceSectionTitle en="What this is for" he="מה המשטח הזה עושה" />
              <p className="text-sm text-muted-foreground" dir="rtl">
                {card.notes_he[0] ?? card.notes[0] ?? "אין הערה קנונית."}
              </p>
            </section>

            <section className="rotem-focus-section">
              <SurfaceSectionTitle en="Runtime and service" he="מיקום ושירות" />
              <div className="grid gap-3">
                <CompactTechnicalValue
                  value={card.runtime_home ?? "External portal"}
                  note={card.runtime_home ? "זהו בית ה-runtime הפעיל." : "זהו פורטל חיצוני, לא runtime של Hermes."}
                />
                <CompactTechnicalValue
                  value={card.service_name}
                  note="זהו שם השירות המקומי שמחזיק את הקו הזה חי."
                />
              </div>
            </section>

            <section className="rotem-focus-section">
              <SurfaceSectionTitle en="Channels" he="חדרים ומשטחים מחוברים" />
              <div className="flex flex-wrap gap-2">
                {card.channels.length > 0 ? (
                  card.channels.map((channel) => (
                    <Badge key={channel} variant="outline" className="normal-case tracking-normal text-foreground/85">
                      {channel}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No bound channels reported.</span>
                )}
              </div>
            </section>

            {card.portal_url && !showPortalButton ? (
              <section className="rotem-focus-section">
                <SurfaceSectionTitle en="Portal" he="פורטל" />
                <CompactTechnicalValue value={card.portal_url} />
              </section>
            ) : null}

            {card.onboarding_commands.length > 0 ? (
              <section className="flex flex-col gap-2">
                <SurfaceSectionTitle en="Canonical commands" he="פקודות קנוניות" />
                {card.onboarding_commands.map((command) => (
                  <CopyValueRow
                    key={command}
                    item={{
                      id: command,
                      kind: "command",
                      label: "Command",
                      label_he: "פקודה",
                      value: command,
                      note: "Use this exact command inside WSL.",
                    }}
                  />
                ))}
              </section>
            ) : null}

            {card.diagnostic_pack_path ? (
              <section className="rotem-focus-section">
                <SurfaceSectionTitle en="Diagnostic pack" he="חבילת דיאגנוסטיקה" />
                <code className="font-mono-ui text-xs text-foreground break-all">{card.diagnostic_pack_path}</code>
              </section>
            ) : null}

            <section className="rotem-focus-section">
              <SurfaceSectionTitle en="Authority files" he="קובצי סמכות" />
              <div className="flex flex-col gap-2">
                {card.authority_paths.map((path) => (
                  <code key={path} className="font-mono-ui text-xs text-foreground break-all">
                    {path}
                  </code>
                ))}
              </div>
            </section>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function QuickPanel({ panel }: { panel: SurfaceQuickPanel }) {
  return (
    <aside className="rotem-focus-side-panel">
      <div className="rotem-focus-side-shell">
        <div className="rotem-focus-kicker">{panel.title}</div>
        <h2 className="rotem-focus-side-title-he" dir="rtl">
          {panel.title_he}
        </h2>
        <div className="rotem-focus-side-title">{panel.title}</div>
        <p className="mt-3 text-sm text-muted-foreground" dir="rtl">
          כאן תמצא תמיד איך בודקים, עוצרים, מפעילים מחדש, ומאתרים את חומרי השיפור.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {panel.sections.map((section) => (
          <QuickPanelSection key={section.id} section={section} />
        ))}
      </div>
    </aside>
  );
}

export default function SurfacesPage() {
  const [data, setData] = useState<SurfacesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getSurfaces()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleFocus = () => load();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };

    load();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const quickPanel = useMemo(() => {
    if (!data?.quick_panel) return null;
    const sections = data.quick_panel.sections.filter((section) => section.id !== "mac-coordination");
    return { ...data.quick_panel, sections };
  }, [data?.quick_panel]);
  const mainControlCards = useMemo(
    () => cards.filter((card) => card.visual_role !== "External"),
    [cards],
  );
  const externalControlCards = useMemo(
    () => cards.filter((card) => card.visual_role === "External"),
    [cards],
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rotem-focus-dashboard-shell mx-auto flex w-full flex-col gap-5 px-3 2xl:px-0">
      <section className="rotem-focus-band rotem-focus-band--intro rotem-focus-band--intro-centered">
        <div className="rotem-focus-hero-shell">
          <div className="rotem-focus-hero-grid">
            <div className="rotem-focus-hero-copy" dir="rtl">
              <div className="rotem-focus-kicker" dir="ltr">Hermes / Madhatter</div>
              <h1 className="rotem-focus-heading-he-hero">
                לוח הבקרה של הרמס מאד־האטר
              </h1>
              <div className="rotem-focus-heading rotem-focus-heading--utility" dir="ltr">
                Runtime Dashboard
              </div>
              <div className="rotem-focus-runtime-shell">
                <div className="rotem-focus-runtime-label-row">
                  <span className="rotem-focus-inline-he">
                    המסך מחובר כעת אל
                  </span>
                  <Badge variant="outline" className="rotem-focus-runtime-chip">
                    {runtimeLabel(data?.runtime_home)}
                  </Badge>
                </div>
                <CompactTechnicalValue value={data?.runtime_home ?? "unknown"} />
              </div>
            </div>
            <div className="rotem-focus-hero-traffic" aria-label="מצב משטחים">
              <TrafficLegend cards={cards} />
            </div>
          </div>
        </div>
      </section>

      <section className="rotem-focus-band rotem-focus-band--summary">
        <div className="mb-4">
          <div className="rotem-focus-kicker">What matters first</div>
          <h2 className="rotem-focus-band-title-he">מה חשוב עכשיו</h2>
        </div>
        <SurfaceSummary cards={cards} />
      </section>

      <div className="rotem-focus-operations-grid">
        <section className="rotem-focus-band rotem-focus-band--controls rotem-focus-controls-main">
          <div className="mb-4">
            <div className="rotem-focus-kicker">Services</div>
            <h2 className="rotem-focus-band-title-he">שירותים</h2>
          </div>
          <div className="rotem-focus-control-card-grid">
            {mainControlCards.map((card) => (
              <SurfaceCardView key={card.id} card={card} />
            ))}
          </div>
        </section>

        <section className="rotem-focus-operations-rail">
          {externalControlCards.map((card) => (
            <SurfaceCardView key={card.id} card={card} />
          ))}
          {quickPanel && quickPanel.sections.length > 0 ? <QuickPanel panel={quickPanel} /> : null}
        </section>
      </div>
    </div>
  );
}
