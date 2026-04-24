(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const PLUGINS = window.__HERMES_PLUGINS__;
  if (!SDK || !PLUGINS) return;

  const { React } = SDK;
  const { useEffect, useMemo, useState } = SDK.hooks;
  const { Card, CardContent, CardHeader, CardTitle, Badge, Button } = SDK.components;

  const panelStyle = {
    background: "color-mix(in srgb, var(--color-card) 94%, transparent)",
    boxShadow: "0 18px 48px -36px var(--warm-glow)",
  };
  const softBoxStyle = {
    border: "1px solid var(--color-border)",
    borderRadius: "calc(var(--theme-radius, 0.5rem) * 0.9)",
    background: "color-mix(in srgb, var(--color-muted) 48%, transparent)",
  };

  function okBadge(ok, yes, no) {
    return React.createElement(Badge, { variant: ok ? "default" : "destructive" }, ok ? yes : no);
  }

  function WhatsAppLogo() {
    return React.createElement("svg", { viewBox: "0 0 32 32", className: "h-12 w-12 shrink-0", "aria-hidden": true },
      React.createElement("circle", { cx: 16, cy: 16, r: 16, fill: "#25D366" }),
      React.createElement("path", {
        fill: "#fff",
        d: "M16.1 7.1a8.5 8.5 0 0 0-7.3 12.8l-1 3.7 3.8-1a8.5 8.5 0 1 0 4.5-15.5Zm0 1.7a6.8 6.8 0 0 1 5.8 10.4 6.8 6.8 0 0 1-8 2.7l-.4-.1-2.2.6.6-2.1-.2-.4a6.8 6.8 0 0 1 4.4-10.9Zm-3.2 3.6c-.2 0-.4 0-.6.4-.2.4-.8 1-.8 2.4s.9 2.8 1 3c.1.2 1.9 3 4.6 4 .6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1 .1-1.2-.1-.2-.3-.3-.6-.4l-1.6-.8c-.2-.1-.4-.1-.6.2l-.7.8c-.2.2-.4.2-.6.1-.2-.1-.9-.3-1.7-1.1-.7-.6-1.1-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5Z",
      }),
    );
  }

  function TelegramXLogo() {
    return React.createElement("div", { className: "flex shrink-0 items-center gap-2" },
      React.createElement("svg", { viewBox: "0 0 32 32", className: "h-12 w-12", "aria-hidden": true },
        React.createElement("circle", { cx: 16, cy: 16, r: 16, fill: "#229ED9" }),
        React.createElement("path", { fill: "#fff", d: "m23.7 9.4-2.3 11c-.2.8-.7 1-1.4.6l-3.6-2.7-1.7 1.6c-.2.2-.4.4-.8.4l.3-3.7 6.8-6.1c.3-.3-.1-.4-.4-.2l-8.4 5.3-3.6-1.1c-.8-.2-.8-.8.2-1.2l14.2-5.5c.7-.2 1.2.2 1 .9Z" }),
      ),
      React.createElement("div", {
        className: "flex h-9 w-9 items-center justify-center border text-sm font-bold",
        style: { borderColor: "var(--color-border)", background: "var(--color-foreground)", color: "var(--color-background)" },
      }, "X"),
    );
  }

  function JarvisLogo() {
    return React.createElement("div", {
      className: "flex h-12 w-12 shrink-0 items-center justify-center border font-bold tracking-[0.18em]",
      style: { borderColor: "var(--color-border)", background: "color-mix(in srgb, var(--color-muted) 65%, transparent)" },
    }, "J");
  }

  function BrandLogo(props) {
    if (props.brand === "whatsapp") return React.createElement(WhatsAppLogo);
    if (props.brand === "telegram-x") return React.createElement(TelegramXLogo);
    return React.createElement(JarvisLogo);
  }

  function CopyCommand(props) {
    const [copied, setCopied] = useState(false);
    function copy() {
      navigator.clipboard.writeText(props.value).then(function () {
        setCopied(true);
        window.setTimeout(function () { setCopied(false); }, 1200);
      }).catch(function () {});
    }
    return React.createElement("div", { className: "flex min-w-0 flex-col gap-2 p-3", style: softBoxStyle },
      React.createElement("div", { className: "flex items-start justify-between gap-3" },
        React.createElement("div", { className: "min-w-0 text-right", dir: "rtl" },
          React.createElement("div", { className: "text-sm font-semibold" }, props.label),
          React.createElement("div", {
            className: "mt-2 block whitespace-pre-wrap break-all p-2 font-mono-ui text-xs normal-case tracking-normal",
            dir: "ltr",
            style: {
              color: "var(--color-card-foreground)",
              background: "color-mix(in srgb, var(--color-card) 75%, var(--color-muted))",
              border: "1px solid var(--color-border)",
              borderRadius: "calc(var(--theme-radius, 0.5rem) * 0.6)",
            },
          }, props.value),
        ),
        React.createElement(Button, { type: "button", variant: "outline", size: "sm", onClick: copy }, copied ? "Copied" : "Copy"),
      ),
    );
  }

  function ServiceCard(props) {
    const item = props.item;
    const status = item.status || {};
    const connected = status.platform_state === "connected" && status.pid_running;
    return React.createElement(Card, { style: panelStyle },
      React.createElement(CardHeader, null,
        React.createElement("div", { className: "flex items-start gap-4" },
          React.createElement(BrandLogo, { brand: item.brand }),
          React.createElement("div", { className: "min-w-0 flex-1 text-right", dir: "rtl" },
            React.createElement("div", { className: "flex flex-wrap justify-end gap-2" },
              okBadge(connected, "מחובר", "דורש בדיקה"),
              React.createElement(Badge, { variant: "outline" }, item.platform),
            ),
            React.createElement(CardTitle, { className: "mt-3 text-lg normal-case tracking-normal" }, item.label_he),
            React.createElement("div", { className: "mt-1 text-xs text-muted-foreground", dir: "ltr" }, item.label),
          ),
        ),
      ),
      React.createElement(CardContent, { className: "flex flex-col gap-4" },
        React.createElement("div", { className: "grid gap-3 md:grid-cols-3" },
          field("שירות", item.service),
          field("מצב", (status.gateway_state || "unknown") + " / " + (status.platform_state || "unknown")),
          field("PID", status.pid ? String(status.pid) + (status.pid_running ? " running" : " stopped") : "unknown"),
        ),
        React.createElement("div", { className: "p-3 text-right", dir: "rtl", style: softBoxStyle },
          React.createElement("div", { className: "mb-2 text-xs text-muted-foreground" }, "ערוצים מחוברים"),
          (item.channels || []).length
            ? React.createElement("div", { className: "flex flex-wrap justify-end gap-2" }, item.channels.map(function (channel) {
                return React.createElement(Badge, { key: channel, variant: "outline", className: "normal-case tracking-normal" }, channel);
              }))
            : React.createElement("div", { className: "text-sm text-muted-foreground" }, "לא דווח ערוץ"),
        ),
        item.cron ? React.createElement("div", { className: "p-3 text-right", dir: "rtl", style: softBoxStyle },
          React.createElement("div", { className: "mb-2 flex flex-wrap items-center justify-between gap-2" },
            React.createElement(Badge, { variant: item.cron.ok ? "default" : "destructive" }, item.cron.active_count + "/" + item.cron.expected_count + " cron"),
            React.createElement("div", { className: "text-sm font-semibold" }, "אינטרוולים של X"),
          ),
          React.createElement("div", { className: "grid gap-2 md:grid-cols-4" }, (item.cron.jobs || []).map(function (job) {
            return React.createElement("div", { key: job.name, className: "p-2 text-left", dir: "ltr", style: softBoxStyle },
              React.createElement("div", { className: "font-mono-ui text-xs" }, job.name),
              React.createElement("div", { className: "font-mono-ui text-xs text-muted-foreground" }, job.schedule),
              React.createElement("div", { className: "mt-1 text-[0.65rem] text-muted-foreground" }, job.next_run_at || "no next run"),
            );
          })),
        ) : null,
        React.createElement("div", { className: "grid gap-3 lg:grid-cols-2" }, (item.commands || []).map(function (command) {
          return React.createElement(CopyCommand, { key: command.value, label: command.label_he, value: command.value });
        })),
      ),
    );
  }

  function field(label, value) {
    return React.createElement("div", { className: "min-w-0 p-3 text-right", dir: "rtl", style: softBoxStyle },
      React.createElement("div", { className: "text-xs text-muted-foreground" }, label),
      React.createElement("div", { className: "mt-1 truncate font-mono-ui text-sm", dir: "ltr" }, value == null || value === "" ? "unknown" : String(value)),
    );
  }

  function JarvisCard(props) {
    const item = props.item;
    return React.createElement(Card, { style: panelStyle },
      React.createElement(CardHeader, null,
        React.createElement("div", { className: "flex items-start gap-4" },
          React.createElement(BrandLogo, { brand: "jarvis" }),
          React.createElement("div", { className: "min-w-0 flex-1 text-right", dir: "rtl" },
            React.createElement("div", { className: "flex justify-end gap-2" },
              React.createElement(Badge, { variant: "outline" }, "External"),
              React.createElement(Badge, { variant: "warning" }, "לא Hermes"),
            ),
            React.createElement(CardTitle, { className: "mt-3 text-lg normal-case tracking-normal" }, item.label_he),
            React.createElement("div", { className: "mt-2 text-sm text-muted-foreground" }, item.note_he),
          ),
        ),
      ),
      React.createElement(CardContent, { className: "flex flex-col gap-3" },
        React.createElement("a", { href: item.portal_url, target: "_blank", rel: "noreferrer" },
          React.createElement(Button, { type: "button", variant: "outline" }, "Open Jarvis external portal"),
        ),
        (item.commands || []).map(function (command) {
          return React.createElement(CopyCommand, { key: command.value, label: command.label_he, value: command.value });
        }),
      ),
    );
  }

  function MadHatterPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [restarting, setRestarting] = useState(false);
    const [action, setAction] = useState(null);

    function refresh() {
      setError(null);
      SDK.fetchJSON("/api/plugins/mad-hatter-dashboard/status")
        .then(setData)
        .catch(function (err) { setError(err && err.message ? err.message : "status fetch failed"); });
    }

    function restartHermes() {
      setRestarting(true);
      setAction(null);
      SDK.api.restartGateway()
        .then(function (result) { setAction("Hermes main restart started: pid " + result.pid); })
        .catch(function (err) { setAction(err && err.message ? err.message : "restart failed"); })
        .finally(function () {
          setRestarting(false);
          window.setTimeout(refresh, 1800);
        });
    }

    useEffect(function () {
      refresh();
      const timer = setInterval(refresh, 30000);
      return function () { clearInterval(timer); };
    }, []);

    const summary = useMemo(function () {
      const mainOk = data && data.main && data.main.status && data.main.status.platform_state === "connected" && data.main.status.pid_running;
      const operatorOk = data && data.operator && data.operator.status && data.operator.status.platform_state === "connected" && data.operator.status.pid_running;
      const cronOk = data && data.operator && data.operator.cron && data.operator.cron.ok;
      return { mainOk, operatorOk, cronOk };
    }, [data]);

    return React.createElement("div", { className: "flex flex-col gap-6" },
      React.createElement("section", { className: "p-5", style: panelStyle },
        React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-4" },
          React.createElement("div", { className: "max-w-4xl text-right", dir: "rtl" },
            React.createElement("div", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", dir: "ltr" }, "Hermes / Madhatter"),
            React.createElement("h1", { className: "mt-2 text-2xl font-semibold normal-case tracking-normal" }, data ? data.title_he : "לוח הבקרה של Hermes Mad Hatter"),
            React.createElement("p", { className: "mt-2 text-sm text-muted-foreground" }, data ? data.subtitle_he : "טוען מצב..."),
          ),
          React.createElement("div", { className: "flex flex-wrap gap-2" },
            okBadge(summary.mainOk, "WhatsApp מחובר", "WhatsApp לבדיקה"),
            okBadge(summary.operatorOk, "Telegram מחובר", "Telegram לבדיקה"),
            okBadge(summary.cronOk, "4 cron תקינים", "cron לבדיקה"),
          ),
        ),
        React.createElement("div", { className: "mt-5 flex flex-wrap gap-3" },
          React.createElement(Button, { type: "button", onClick: refresh, variant: "outline" }, "Refresh"),
          React.createElement(Button, { type: "button", onClick: restartHermes, disabled: restarting }, restarting ? "Restarting Hermes" : "Hermes only: restart main"),
          React.createElement("a", { href: "/twitter-operator" }, React.createElement(Button, { type: "button", variant: "outline" }, "Open Twitter Operator")),
          React.createElement("a", { href: "/" }, React.createElement(Button, { type: "button", variant: "outline" }, "Open Hermes Status")),
        ),
        action ? React.createElement("div", { className: "mt-3 text-sm text-muted-foreground" }, action) : null,
        error ? React.createElement("div", { className: "mt-3 text-sm text-destructive" }, error) : null,
      ),
      data ? React.createElement("div", { className: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" },
        React.createElement(ServiceCard, { item: data.main }),
        React.createElement(ServiceCard, { item: data.operator }),
      ) : null,
      data ? React.createElement(JarvisCard, { item: data.jarvis }) : null,
    );
  }

  PLUGINS.register("mad-hatter-dashboard", MadHatterPage);
})();
