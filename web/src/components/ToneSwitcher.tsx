import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

type Tone = "dusk" | "night";

const STORAGE_KEY = "hermes-ui-tone";

function applyTone(tone: Tone) {
  document.documentElement.dataset.tone = tone;
}

export function ToneSwitcher() {
  const [tone, setTone] = useState<Tone>(() => {
    if (typeof window === "undefined") return "dusk";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "night" ? "night" : "dusk";
  });

  useEffect(() => {
    applyTone(tone);
    window.localStorage.setItem(STORAGE_KEY, tone);
  }, [tone]);

  const nextTone: Tone = tone === "dusk" ? "night" : "dusk";
  const label = tone === "dusk" ? "Switch to deeper tone" : "Switch to brighter tone";

  return (
    <button
      type="button"
      onClick={() => setTone(nextTone)}
      className="group relative inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      title={label}
      aria-label={label}
    >
      {tone === "dusk" ? (
        <>
          <MoonStar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline font-display tracking-wide uppercase text-[0.65rem]">
            Night
          </span>
        </>
      ) : (
        <>
          <SunMedium className="h-3.5 w-3.5" />
          <span className="hidden sm:inline font-display tracking-wide uppercase text-[0.65rem]">
            Dusk
          </span>
        </>
      )}
    </button>
  );
}
