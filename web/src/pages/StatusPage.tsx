import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Cpu,
  Database,
  Gauge,
  KeyRound,
  MessageSquare,
  Package,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  CronJob,
  ModelInfoResponse,
  OAuthProvider,
  PlatformStatus,
  SessionInfo,
  SkillInfo,
  StatusResponse,
} from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

export default function StatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    const load = () => {
      api.getStatus().then(setStatus).catch(() => {});
      api.getSessions(50).then((resp) => setSessions(resp.sessions)).catch(() => {});
      api.getModelInfo().then(setModelInfo).catch(() => {});
      api.getOAuthProviders().then((resp) => setProviders(resp.providers)).catch(() => {});
      api.getCronJobs().then(setCronJobs).catch(() => {});
      api.getSkills().then(setSkills).catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const PLATFORM_STATE_BADGE: Record<string, { variant: "success" | "warning" | "destructive"; label: string }> = {
    connected: { variant: "success", label: t.status.connected },
    disconnected: { variant: "warning", label: t.status.disconnected },
    fatal: { variant: "destructive", label: t.status.error },
  };

  const GATEWAY_STATE_DISPLAY: Record<string, { badge: "success" | "warning" | "destructive" | "outline"; label: string }> = {
    running: { badge: "success", label: t.status.running },
    starting: { badge: "warning", label: t.status.starting },
    startup_failed: { badge: "destructive", label: t.status.failed },
    stopped: { badge: "outline", label: t.status.stopped },
  };

  function gatewayValue(): string {
    if (status!.gateway_running && status!.gateway_pid) return `${t.status.pid} ${status!.gateway_pid}`;
    if (status!.gateway_running) return t.status.runningRemote;
    if (status!.gateway_state === "startup_failed") return t.status.startFailed;
    return t.status.notRunning;
  }

  function gatewayBadge() {
    const info = status!.gateway_state ? GATEWAY_STATE_DISPLAY[status!.gateway_state] : null;
    if (info) return info;
    return status!.gateway_running
      ? { badge: "success" as const, label: t.status.running }
      : { badge: "outline" as const, label: t.common.off };
  }

  const gwBadge = gatewayBadge();

  const currentProvider = providers.find((p) => p.id === modelInfo?.provider) ?? null;
  const whatsappStatus = status.gateway_platforms?.whatsapp ?? null;
  const enabledSkills = skills.filter((skill) => skill.enabled).length;
  const activeCronJobs = cronJobs.filter((job) => job.enabled).length;
  const activeSessionsCount = sessions.filter((session) => session.is_active).length;
  const recentSessions = sessions.filter((s) => !s.is_active).slice(0, 4);
  const activeSessions = sessions.filter((s) => s.is_active).slice(0, 4);

  const items = [
    {
      icon: Bot,
      label: "Agent",
      value: `v${status.version}`,
      badgeText: "Ready",
      badgeVariant: "success" as const,
    },
    {
      icon: Cpu,
      label: "Provider",
      value: modelInfo?.provider || "unresolved",
      badgeText: currentProvider?.status.logged_in ? "Auth live" : "Needs auth",
      badgeVariant: (currentProvider?.status.logged_in ? "success" : "warning") as "success" | "warning",
    },
    {
      icon: Radio,
      label: "Gateway",
      value: gatewayValue(),
      badgeText: gwBadge.label,
      badgeVariant: gwBadge.badge,
    },
    {
      icon: MessageSquare,
      label: "WhatsApp",
      value: whatsappStatus?.state ?? (status.gateway_running ? "waiting telemetry" : "offline"),
      badgeText: whatsappStatus?.state === "connected" ? "Bound" : "Check",
      badgeVariant: (whatsappStatus?.state === "connected" ? "success" : "warning") as "success" | "warning",
    },
    {
      icon: Activity,
      label: "Sessions",
      value: activeSessionsCount > 0 ? `${activeSessionsCount} live` : "No live sessions",
      badgeText: activeSessionsCount > 0 ? "Live" : "Idle",
      badgeVariant: (activeSessionsCount > 0 ? "success" : "outline") as "success" | "outline",
    },
    {
      icon: Package,
      label: "Skills",
      value: `${enabledSkills}/${skills.length || 0}`,
      badgeText: "Enabled",
      badgeVariant: "secondary" as const,
    },
  ];

  const platforms = Object.entries(status.gateway_platforms ?? {});

  // Collect alerts that need attention
  const alerts: { message: string; detail?: string }[] = [];
  if (status.gateway_state === "startup_failed") {
    alerts.push({
      message: t.status.gatewayFailedToStart,
      detail: status.gateway_exit_reason ?? undefined,
    });
  }
  const failedPlatforms = platforms.filter(([, info]) => info.state === "fatal" || info.state === "disconnected");
  for (const [name, info] of failedPlatforms) {
    const stateLabel = info.state === "fatal" ? t.status.platformError : t.status.platformDisconnected;
    alerts.push({
      message: `${name.charAt(0).toUpperCase() + name.slice(1)} ${stateLabel}`,
      detail: info.error_message ?? undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-warning" />
                <CardTitle className="text-base">Control Room</CardTitle>
              </div>
              <CardDescription>
                Main runtime: {status.hermes_home}. Sessions are aggregated across live runtimes; env, skills, config, cron, and logs stay runtime-local.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip
                label={modelInfo?.model || "model pending"}
                variant={currentProvider?.status.logged_in ? "success" : "warning"}
              />
              <StatusChip
                label={status.fallback_model ? `Fallback ${status.fallback_provider || "configured"}` : "No fallback"}
                variant={status.fallback_model ? "secondary" : "warning"}
              />
              <StatusChip
                label={status.gateway_running ? "Gateway running" : "Gateway down"}
                variant={status.gateway_running ? "success" : "destructive"}
              />
              <StatusChip
                label={whatsappStatus?.state === "connected" ? "WhatsApp connected" : "WhatsApp check"}
                variant={whatsappStatus?.state === "connected" ? "success" : "warning"}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ControlMetric
            icon={ShieldCheck}
            label="Provider auth"
            value={currentProvider?.status.logged_in ? currentProvider.name : "Not authenticated"}
            subValue={currentProvider?.status.logged_in ? (currentProvider.status.source_label || currentProvider.status.source || "active") : "Open Keys to fix"}
            badgeLabel={currentProvider?.status.logged_in ? "Live" : "Fix"}
            badgeVariant={currentProvider?.status.logged_in ? "success" : "warning"}
          />
          <ControlMetric
            icon={Gauge}
            label="Model"
            value={modelInfo?.model || "unknown"}
            subValue={modelInfo?.capabilities?.context_window ? `${Intl.NumberFormat().format(modelInfo.capabilities.context_window)} ctx` : "context pending"}
            badgeLabel={modelInfo?.capabilities?.supports_reasoning ? "Reasoning" : "Standard"}
            badgeVariant={modelInfo?.capabilities?.supports_reasoning ? "secondary" : "outline"}
          />
          <ControlMetric
            icon={Bot}
            label="Fallback"
            value={status.fallback_model || "not configured"}
            subValue={status.fallback_provider || "disabled"}
            badgeLabel={status.fallback_model ? "Armed" : "Unset"}
            badgeVariant={status.fallback_model ? "success" : "warning"}
          />
          <ControlMetric
            icon={Wifi}
            label="Messaging"
            value={whatsappStatus?.state ?? "telemetry pending"}
            subValue={status.gateway_updated_at ? `Updated ${timeAgo(Date.parse(status.gateway_updated_at) / 1000)}` : "No update timestamp"}
            badgeLabel={whatsappStatus?.state === "connected" ? "Bound" : "Check"}
            badgeVariant={whatsappStatus?.state === "connected" ? "success" : "warning"}
          />
          <ControlMetric
            icon={Wrench}
            label="Ops"
            value={`${activeCronJobs} cron / ${enabledSkills} skills`}
            subValue={`${cronJobs.length} jobs tracked`}
            badgeLabel="Ready"
            badgeVariant="secondary"
          />
        </CardContent>
      </Card>

      {/* Alert banner — breaks grid monotony for critical states */}
      {alerts.length > 0 && (
        <div className="border border-destructive/30 bg-destructive/[0.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex flex-col gap-2 min-w-0">
              {alerts.map((alert, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-destructive">{alert.message}</p>
                  {alert.detail && (
                    <p className="text-xs text-destructive/70 mt-0.5">{alert.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ icon: Icon, label, value, badgeText, badgeVariant }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold font-display">{value}</div>

              {badgeText && (
                <Badge variant={badgeVariant} className="mt-2">
                  {badgeVariant === "success" && (
                    <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  )}
                  {badgeText}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Provider Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <KeyValueRow label="Active provider" value={modelInfo?.provider || "unknown"} />
            <KeyValueRow label="Active model" value={modelInfo?.model || "unknown"} />
            <KeyValueRow label="OAuth state" value={currentProvider?.status.logged_in ? "authenticated" : "not authenticated"} />
            <KeyValueRow label="Token source" value={currentProvider?.status.source_label || currentProvider?.status.source || "n/a"} />
            <KeyValueRow label="Context window" value={modelInfo?.capabilities?.context_window ? Intl.NumberFormat().format(modelInfo.capabilities.context_window) : "n/a"} />
            <KeyValueRow label="Capabilities" value={formatCapabilities(modelInfo)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Messaging Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <KeyValueRow label="Gateway state" value={status.gateway_state || "unknown"} />
            <KeyValueRow label="Gateway PID" value={status.gateway_pid ? String(status.gateway_pid) : "not running"} />
            <KeyValueRow label="WhatsApp" value={whatsappStatus?.state || "not exposed"} />
            <KeyValueRow label="Last gateway update" value={status.gateway_updated_at ? new Date(status.gateway_updated_at).toLocaleString() : "n/a"} />
            <KeyValueRow label="Hermes home" value={status.hermes_home} />
            <KeyValueRow label="Config path" value={status.config_path} />
          </CardContent>
        </Card>
      </div>

      {platforms.length > 0 && (
        <PlatformsCard platforms={platforms} platformStateBadge={PLATFORM_STATE_BADGE} />
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-success" />
              <CardTitle className="text-base">Session Radar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {activeSessions.length === 0 && recentSessions.length === 0 ? (
              <div className="border border-border p-3 text-sm text-muted-foreground">
                No session history is being surfaced yet.
              </div>
            ) : (
              [...activeSessions, ...recentSessions].slice(0, 6).map((s) => (
                <SessionMiniRow key={s.id} session={s} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Quick Routes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <QuickRoute to="/env" icon={KeyRound} title="Keys" subtitle="Fix auth and provider keys" />
            <QuickRoute to="/config" icon={Settings} title="Config" subtitle="Model, runtime, display" />
            <QuickRoute to="/logs" icon={Database} title="Logs" subtitle="See failures and runtime output" />
            <QuickRoute to="/cron" icon={Clock} title="Cron" subtitle="Automation and scheduled ops" />
            <QuickRoute to="/skills" icon={Package} title="Skills" subtitle="Enable, inspect, govern" />
            <QuickRoute to="/sessions" icon={MessageSquare} title="Sessions" subtitle="Inspect active and recent chats" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusChip({ label, variant }: { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }) {
  return <Badge variant={variant}>{label}</Badge>;
}

function ControlMetric({
  icon: Icon,
  label,
  value,
  subValue,
  badgeLabel,
  badgeVariant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue: string;
  badgeLabel: string;
  badgeVariant: "success" | "warning" | "secondary" | "outline" | "destructive";
}) {
  return (
    <div className="border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
          <span className="text-lg font-display truncate">{value}</span>
          <span className="text-xs text-muted-foreground">{subValue}</span>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <Badge variant={badgeVariant} className="mt-3">
        {badgeLabel}
      </Badge>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <span className="text-sm font-courier break-all sm:text-right">{value}</span>
    </div>
  );
}

function SessionMiniRow({ session }: { session: SessionInfo }) {
  return (
    <div className="flex flex-col gap-1 border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{session.title ?? "Untitled"}</span>
        <Badge variant={session.is_active ? "success" : "outline"} className="shrink-0">
          {session.is_active ? "Live" : "Recent"}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground">
        <span className="font-mono-ui">{(session.model ?? "unknown").split("/").pop()}</span> · {session.message_count} msgs · {timeAgo(session.last_active)}
      </span>
      {session.preview && (
        <span className="truncate text-xs text-muted-foreground/70">{session.preview}</span>
      )}
    </div>
  );
}

function QuickRoute({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 border border-border p-3 transition-colors hover:bg-foreground/5"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  );
}

function formatCapabilities(modelInfo: ModelInfoResponse | null): string {
  if (!modelInfo?.capabilities) return "n/a";
  const parts = [];
  if (modelInfo.capabilities.supports_tools) parts.push("tools");
  if (modelInfo.capabilities.supports_vision) parts.push("vision");
  if (modelInfo.capabilities.supports_reasoning) parts.push("reasoning");
  return parts.length ? parts.join(", ") : "standard";
}

function PlatformsCard({ platforms, platformStateBadge }: PlatformsCardProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{t.status.connectedPlatforms}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3">
        {platforms.map(([name, info]) => {
          const display = platformStateBadge[info.state] ?? {
            variant: "outline" as const,
            label: info.state,
          };
          const IconComponent = info.state === "connected" ? Wifi : info.state === "fatal" ? AlertTriangle : WifiOff;

          return (
            <div
              key={name}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-border p-3 w-full"
            >
              <div className="flex items-center gap-3 min-w-0 w-full">
                <IconComponent className={`h-4 w-4 shrink-0 ${
                  info.state === "connected"
                    ? "text-success"
                    : info.state === "fatal"
                      ? "text-destructive"
                      : "text-warning"
                }`} />

                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium capitalize truncate">{name}</span>

                  {info.error_message && (
                    <span className="text-xs text-destructive">{info.error_message}</span>
                  )}

                  {info.updated_at && (
                    <span className="text-xs text-muted-foreground">
                      {t.status.lastUpdate}: {timeAgo(Date.parse(info.updated_at) / 1000)}
                    </span>
                  )}
                </div>
              </div>

              <Badge variant={display.variant} className="shrink-0 self-start sm:self-center">
                {display.variant === "success" && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                )}
                {display.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface PlatformsCardProps {
  platforms: [string, PlatformStatus][];
  platformStateBadge: Record<string, { variant: "success" | "warning" | "destructive"; label: string }>;
}
