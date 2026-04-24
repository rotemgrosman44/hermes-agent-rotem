(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) return;

  const { React } = SDK;
  const { useEffect, useState } = SDK.hooks;
  const { Card, CardContent, CardHeader, CardTitle, Badge, Button } = SDK.components;

  function statusVariant(ok) {
    return ok ? "default" : "destructive";
  }

  function field(label, value) {
    return React.createElement("div", { className: "flex min-w-0 flex-col gap-1" },
      React.createElement("span", { className: "text-xs text-muted-foreground" }, label),
      React.createElement("span", { className: "truncate font-courier text-sm" }, value == null || value === "" ? "unknown" : String(value)),
    );
  }

  function JobRow(props) {
    const job = props.job;
    return React.createElement("tr", { className: "border-t border-border" },
      React.createElement("td", { className: "py-2 pr-3 font-courier text-sm" }, job.name || job.id || "job"),
      React.createElement("td", { className: "py-2 pr-3 font-courier text-sm" }, job.schedule || "unknown"),
      React.createElement("td", { className: "py-2 pr-3" },
        React.createElement(Badge, { variant: job.enabled && job.state !== "paused" ? "default" : "outline" }, job.state || (job.enabled ? "active" : "disabled")),
      ),
      React.createElement("td", { className: "py-2 pr-3 font-courier text-xs text-muted-foreground" }, job.next_run_at || "unknown"),
      React.createElement("td", { className: "py-2 font-courier text-xs text-muted-foreground" }, job.last_run_at || "never"),
    );
  }

  function TwitterOperatorPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    function refresh() {
      setLoading(true);
      setError(null);
      SDK.fetchJSON("/api/plugins/twitter-operator-status/status")
        .then(setData)
        .catch(function (err) { setError(err && err.message ? err.message : "status fetch failed"); })
        .finally(function () { setLoading(false); });
    }

    useEffect(function () {
      refresh();
      const timer = setInterval(refresh, 30000);
      return function () { clearInterval(timer); };
    }, []);

    const gateway = data && data.gateway ? data.gateway : {};
    const cron = data && data.cron ? data.cron : { jobs: [] };
    const watchdog = data && data.watchdog ? data.watchdog : {};
    const telegramOk = gateway.telegram_state === "connected" && gateway.pid_running;
    const cronOk = Boolean(cron.ok);

    return React.createElement("div", { className: "flex flex-col gap-6" },
      React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        React.createElement("div", { className: "flex flex-wrap items-center gap-3" },
          React.createElement("h1", { className: "text-xl font-semibold" }, "Twitter Operator"),
          React.createElement(Badge, { variant: statusVariant(telegramOk) }, telegramOk ? "Telegram connected" : "Telegram attention"),
          React.createElement(Badge, { variant: statusVariant(cronOk) }, cronOk ? "4 cron jobs" : "Cron drift"),
        ),
        React.createElement(Button, { onClick: refresh, disabled: loading }, loading ? "Refreshing" : "Refresh"),
      ),

      error && React.createElement(Card, null,
        React.createElement(CardContent, { className: "pt-6 text-sm text-destructive" }, error),
      ),

      React.createElement(Card, null,
        React.createElement(CardHeader, null,
          React.createElement(CardTitle, null, "Runtime"),
        ),
        React.createElement(CardContent, { className: "grid gap-4 md:grid-cols-4" },
          field("HERMES_HOME", data && data.operator_home),
          field("Gateway", gateway.gateway_state),
          field("PID", gateway.pid ? gateway.pid + (gateway.pid_running ? " running" : " stopped") : "unknown"),
          field("Updated", gateway.updated_at),
          field("Telegram", gateway.telegram_state),
          field("Telegram updated", gateway.telegram_updated_at),
          field("Watchdog", watchdog.state),
          field("Active agents", gateway.active_agents),
        ),
      ),

      React.createElement(Card, null,
        React.createElement(CardHeader, null,
          React.createElement("div", { className: "flex items-center justify-between gap-3" },
            React.createElement(CardTitle, null, "Cron"),
            React.createElement(Badge, { variant: statusVariant(cronOk) }, (cron.active_count || 0) + "/" + (cron.expected_count || 4) + " active"),
          ),
        ),
        React.createElement(CardContent, null,
          React.createElement("div", { className: "overflow-x-auto" },
            React.createElement("table", { className: "w-full min-w-[720px] text-left" },
              React.createElement("thead", null,
                React.createElement("tr", { className: "text-xs text-muted-foreground" },
                  React.createElement("th", { className: "pb-2 pr-3 font-normal" }, "Name"),
                  React.createElement("th", { className: "pb-2 pr-3 font-normal" }, "Schedule"),
                  React.createElement("th", { className: "pb-2 pr-3 font-normal" }, "State"),
                  React.createElement("th", { className: "pb-2 pr-3 font-normal" }, "Next"),
                  React.createElement("th", { className: "pb-2 font-normal" }, "Last"),
                ),
              ),
              React.createElement("tbody", null, (cron.jobs || []).map(function (job) {
                return React.createElement(JobRow, { key: job.id || job.name, job: job });
              })),
            ),
          ),
        ),
      ),
    );
  }

  window.__HERMES_PLUGINS__.register("twitter-operator-status", TwitterOperatorPage);
})();
