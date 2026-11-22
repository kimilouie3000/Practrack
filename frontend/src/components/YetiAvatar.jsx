import { useEffect, useRef, useState } from "react";
import "../yeti.css";
import "../yeti-mascot.css";

/**
 * PracTrack's decorative login mascot.
 * Existing props from App.jsx are preserved; no authentication changes.
 * A PNG is a single pose: the wave is a gentle character sway, not a rigged arm.
 */
export default function YetiAvatar({
  focusField = null,
  passwordVisible = false,
  mood = "idle",
  emailValue = ""
}) {
  const panelRef = useRef(null);
  const waveTimeoutRef = useRef(null);
  const blinkTimeoutRef = useRef(null);
  const blinkEndRef = useRef(null);
  const frameRef = useRef(null);
  const [waving, setWaving] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const updatePreference = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  // Say hello once, then wave again when the card is hovered.
  useEffect(() => {
    if (reducedMotion) return undefined;
    setWaving(true);
    waveTimeoutRef.current = window.setTimeout(() => setWaving(false), 1450);
    return () => window.clearTimeout(waveTimeoutRef.current);
  }, [reducedMotion]);

  // Short, randomized blinks. Pause while the tab is hidden or password is focused.
  useEffect(() => {
    if (reducedMotion || focusField === "password") {
      setBlinking(false);
      return undefined;
    }

    let stopped = false;
    const blink = () => {
      blinkTimeoutRef.current = window.setTimeout(() => {
        if (stopped) return;
        if (!document.hidden) {
          setBlinking(true);
          blinkEndRef.current = window.setTimeout(() => {
            if (!stopped) setBlinking(false);
          }, 125);
        }
        blink();
      }, 3500 + Math.random() * 2000);
    };
    blink();

    return () => {
      stopped = true;
      window.clearTimeout(blinkTimeoutRef.current);
      window.clearTimeout(blinkEndRef.current);
    };
  }, [focusField, reducedMotion]);

  // Only the small character shifts: no WebGL or perpetual JS render loop.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const reset = () => {
      panel.style.setProperty("--toy-look-x", "0px");
      panel.style.setProperty("--toy-look-y", "0px");
    };

    if (reducedMotion || focusField || mood !== "idle") {
      reset();
      return undefined;
    }

    const onPointerMove = (event) => {
      if (event.pointerType === "touch" || frameRef.current !== null) return;
      const { clientX, clientY } = event;
      frameRef.current = requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        const x = (clientX - rect.left - rect.width / 2) / rect.width;
        const y = (clientY - rect.top - rect.height / 2) / rect.height;
        panel.style.setProperty("--toy-look-x", `${Math.max(-3, Math.min(3, x * 5))}px`);
        panel.style.setProperty("--toy-look-y", `${Math.max(-2, Math.min(2, y * 4))}px`);
        frameRef.current = null;
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      reset();
    };
  }, [focusField, mood, reducedMotion]);

  const waveHello = () => {
    if (reducedMotion || mood !== "idle") return;
    window.clearTimeout(waveTimeoutRef.current);
    setWaving(false);
    requestAnimationFrame(() => {
      setWaving(true);
      waveTimeoutRef.current = window.setTimeout(() => setWaving(false), 1250);
    });
  };

  const passwordFocused = focusField === "password";
  const shy = passwordFocused && !passwordVisible && mood === "idle";
  const peeking = passwordFocused && passwordVisible && mood === "idle";
  const readingEmail = focusField === "email" && mood === "idle";

  let message = "";
  if (mood === "happy") message = "Yay!";
  else if (mood === "sad") message = "Try again!";
  else if (shy) message = "No peeking!";
  else if (peeking) message = "Peek!";
  else if (readingEmail && emailValue.trim()) message = "Looking good!";
  else if (waving) message = "Hello!";

  return (
    <div
      ref={panelRef}
      className="toy-yeti-panel"
      data-waving={waving}
      data-blinking={blinking}
      data-shy={shy}
      data-peeking={peeking}
      data-reading={readingEmail}
      data-mood={mood}
      onPointerEnter={waveHello}
      aria-hidden="true"
    >
      <span className="toy-yeti-light" />
      <span className="toy-yeti-floor" />
      <span className="toy-yeti-star toy-yeti-star-one" />
      <span className="toy-yeti-star toy-yeti-star-two" />

      <div className="toy-yeti-figure">
        <img
          className="toy-yeti-image"
          src="/images/practrack-yeti-toy.png"
          alt=""
          width="877"
          height="960"
          loading="eager"
          decoding="async"
          draggable="false"
        />
        {/* Brief eyelids positioned to the PNG's real eye coordinates. */}
        <svg className="toy-yeti-blink-svg" viewBox="0 0 877 960" aria-hidden="true">
          <defs>
            <linearGradient id="toy-left-lid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#55d0ed" />
              <stop offset="1" stopColor="#43c4e3" />
            </linearGradient>
            <linearGradient id="toy-right-lid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#69dbf4" />
              <stop offset="1" stopColor="#50ceeb" />
            </linearGradient>
          </defs>
          <g className="toy-yeti-closed-eyes">
            <ellipse cx="400" cy="260" rx="27" ry="30" fill="url(#toy-left-lid)" />
            <ellipse cx="542" cy="260" rx="27" ry="30" fill="url(#toy-right-lid)" />
            <path d="M381 261 Q400 274 419 261 M524 261 Q542 274 560 261" fill="none" stroke="#238cae" strokeWidth="4" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      <div className="toy-yeti-slogan">
        EXPLORE.<br />LEARN.<br />GROW.
        <span className="toy-yeti-underline" />
      </div>

      <span className="toy-yeti-cue" key={message || "empty"}>
        {message}
      </span>
      <span className="toy-yeti-wave-spark" />
    </div>
  );
}
