(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) return;

  const { React } = SDK;
  const { Card, CardContent, CardHeader, CardTitle, Badge, Button } = SDK.components;

  const repo = "/home/rotemg/.hermes/hermes-agent";
  const home = "/home/rotemg/.hermes/profiles/madhatter";
  const command = `cd ${repo} && HERMES_HOME=${home} .venv/bin/hermes --tui`;
  const wslCommand = `wsl.exe -d Ubuntu --cd ${repo} -- bash -lc '${command.replace(/'/g, "'\\''")}; exec bash'`;
  const terminalHref = `ms-terminal:?commandline=${encodeURIComponent(wslCommand)}`;

  function field(label, value) {
    return React.createElement("div", { className: "flex min-w-0 flex-col gap-1" },
      React.createElement("span", { className: "text-xs text-muted-foreground" }, label),
      React.createElement("span", { className: "truncate font-courier text-sm" }, value),
    );
  }

  function TuiLauncherPage() {
    return React.createElement("div", { className: "flex flex-col gap-6" },
      React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        React.createElement("div", { className: "flex flex-wrap items-center gap-3" },
          React.createElement("h1", { className: "text-xl font-semibold" }, "Hermes TUI"),
          React.createElement(Badge, { variant: "default" }, "v0.11"),
          React.createElement(Badge, { variant: "outline" }, "terminal"),
        ),
        React.createElement("a", { href: terminalHref },
          React.createElement(Button, null, "Open TUI"),
        ),
      ),

      React.createElement(Card, null,
        React.createElement(CardHeader, null,
          React.createElement(CardTitle, null, "Launch"),
        ),
        React.createElement(CardContent, { className: "grid gap-4 md:grid-cols-2" },
          field("Profile", "madhatter"),
          field("HERMES_HOME", home),
          field("Repo", repo),
          field("Mode", "modern TUI"),
        ),
      ),

      React.createElement(Card, null,
        React.createElement(CardHeader, null,
          React.createElement(CardTitle, null, "Command"),
        ),
        React.createElement(CardContent, null,
          React.createElement("pre", { className: "overflow-x-auto rounded bg-muted/40 p-3 font-courier text-xs normal-case text-foreground" }, command),
        ),
      ),
    );
  }

  window.__HERMES_PLUGINS__.register("tui-launcher", TuiLauncherPage);
})();
