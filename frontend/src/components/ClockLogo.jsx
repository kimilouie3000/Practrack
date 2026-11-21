
import {
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

const PREVIEW_TIME = new Date(
  2026, 0, 1, 10, 8, 30
);

function formatTime(date) {
  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

export default function ClockLogo() {
  const gradientId = useId().replace(/:/g, "");

  const clockRef = useRef(null);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const [preview, setPreview] = useState(false);
  const [timeLabel, setTimeLabel] = useState(
    () => formatTime(new Date())
  );
  const [tooltip, setTooltip] = useState(null);

  // Real-time clock animation
  useEffect(() => {
    let animationFrame = null;
    let interval = null;
    let lastFrame = 0;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function updateHands(date) {
      const milliseconds = date.getMilliseconds();

      const seconds =
        date.getSeconds() + milliseconds / 1000;

      const minutes =
        date.getMinutes() + seconds / 60;

      const hours =
        (date.getHours() % 12) + minutes / 60;

      const hourAngle = hours * 30;
      const minuteAngle = minutes * 6;
      const secondAngle = seconds * 6;

      hourRef.current?.setAttribute(
        "transform",
        `rotate(${hourAngle} 50 50)`
      );

      minuteRef.current?.setAttribute(
        "transform",
        `rotate(${minuteAngle} 50 50)`
      );

      secondRef.current?.setAttribute(
        "transform",
        `rotate(${secondAngle} 50 50)`
      );
    }

    if (preview) {
      updateHands(PREVIEW_TIME);
      setTimeLabel(formatTime(PREVIEW_TIME));

      return;
    }

    updateHands(new Date());
    setTimeLabel(formatTime(new Date()));

    function animate(timestamp) {
      if (timestamp - lastFrame >= 33) {
        updateHands(new Date());
        lastFrame = timestamp;
      }

      animationFrame = requestAnimationFrame(
        animate
      );
    }

    if (reducedMotion) {
      interval = window.setInterval(() => {
        const now = new Date();
        updateHands(now);
        setTimeLabel(formatTime(now));
      }, 1000);
    } else {
      animationFrame = requestAnimationFrame(
        animate
      );

      interval = window.setInterval(() => {
        setTimeLabel(formatTime(new Date()));
      }, 1000);
    }

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [preview]);

  // Apply lightweight 3D tilt
  function updateTilt(event) {
    const element = clockRef.current;

    if (!element) return;

    const rect = element.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) / rect.width;

    const y =
      (event.clientY - rect.top) / rect.height;

    const rotateX = (0.5 - y) * 22;
    const rotateY = (x - 0.5) * 22;

    element.style.setProperty(
      "--clock-rx",
      `${rotateX}deg`
    );

    element.style.setProperty(
      "--clock-ry",
      `${rotateY}deg`
    );
  }

  function resetTilt() {
    const element = clockRef.current;

    if (!element) return;

    element.style.setProperty(
      "--clock-rx",
      "0deg"
    );

    element.style.setProperty(
      "--clock-ry",
      "0deg"
    );
  }

  function showTooltip() {
    const rect =
      clockRef.current?.getBoundingClientRect();

    if (!rect) return;

    const width = 205;

    const left = Math.max(
      8,
      Math.min(
        rect.right + 12,
        window.innerWidth - width - 8
      )
    );

    setTooltip({
      top: Math.max(
        8,
        Math.min(
          rect.top,
          window.innerHeight - 85
        )
      ),
      left
    });
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;

    dragRef.current = {
      x: event.clientX,
      y: event.clientY
    };

    suppressClickRef.current = false;

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function handlePointerMove(event) {
    updateTilt(event);

    if (!dragRef.current) return;

    const distance = Math.hypot(
      event.clientX - dragRef.current.x,
      event.clientY - dragRef.current.y
    );

    if (distance > 6) {
      suppressClickRef.current = true;
    }
  }

  function handlePointerUp(event) {
    dragRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    resetTilt();
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setPreview(current => !current);
  }

  const ticks = Array.from(
    { length: 12 },
    (_, index) => {
      const angle =
        (index * 30 - 90) * Math.PI / 180;

      const major = index % 3 === 0;

      return {
        x1: 50 + Math.cos(angle) * (major ? 34 : 37),
        y1: 50 + Math.sin(angle) * (major ? 34 : 37),
        x2: 50 + Math.cos(angle) * 42,
        y2: 50 + Math.sin(angle) * 42,
        major
      };
    }
  );

  return (
    <>
      <button
        ref={clockRef}
        type="button"
        className={`clock-logo ${
          preview ? "clock-logo-preview" : ""
        }`}
        aria-label={
          preview
            ? "Preview clock. Click to return to live time."
            : `Live clock: ${timeLabel}. Click to preview.`
        }
        aria-pressed={preview}
        onClick={handleClick}
        onPointerEnter={showTooltip}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          resetTilt();
          setTooltip(null);
        }}
        onFocus={showTooltip}
        onBlur={() => setTooltip(null)}
      >
        <span className="clock-logo-body">
          <svg
            className="clock-logo-dial"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <defs>
              <radialGradient
                id={`face-${gradientId}`}
                cx="38%"
                cy="30%"
                r="78%"
              >
                <stop
                  offset="0%"
                  stopColor="#344e86"
                />
                <stop
                  offset="55%"
                  stopColor="#192c51"
                />
                <stop
                  offset="100%"
                  stopColor="#081326"
                />
              </radialGradient>

              <linearGradient
                id={`hand-${gradientId}`}
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#ffffff"
                />
                <stop
                  offset="100%"
                  stopColor="#94b7ff"
                />
              </linearGradient>
            </defs>

            <circle
              cx="50"
              cy="50"
              r="46"
              fill={`url(#face-${gradientId})`}
              stroke="#6687c9"
              strokeWidth="2"
            />

            <circle
              cx="50"
              cy="50"
              r="43"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.12"
              strokeWidth="0.8"
            />

            {ticks.map((tick, index) => (
              <line
                key={index}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={
                  tick.major
                    ? "#dbe7ff"
                    : "#7392cb"
                }
                strokeWidth={
                  tick.major ? 3 : 1.5
                }
                strokeLinecap="round"
              />
            ))}

            <g ref={hourRef}>
              <line
                x1="50"
                y1="54"
                x2="50"
                y2="29"
                stroke={`url(#hand-${gradientId})`}
                strokeWidth="7"
                strokeLinecap="round"
              />
            </g>

            <g ref={minuteRef}>
              <line
                x1="50"
                y1="57"
                x2="50"
                y2="20"
                stroke="#f2f7ff"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </g>

            <g ref={secondRef}>
              <line
                x1="50"
                y1="63"
                x2="50"
                y2="16"
                stroke="#65e5dd"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            <circle
              cx="50"
              cy="50"
              r="5"
              fill="#bcefff"
            />

            <circle
              cx="50"
              cy="50"
              r="2.5"
              fill="#263a61"
            />
          </svg>
        </span>
      </button>

      {tooltip && createPortal(
        <div
          className="clock-logo-tooltip"
          role="tooltip"
          style={{
            top: tooltip.top,
            left: tooltip.left
          }}
        >
          <strong>
            {preview
              ? "Preview mode"
              : "Live local time"}
          </strong>

          <span>{timeLabel}</span>

          <small>
            {preview
              ? "Click to return to live time"
              : "Click to preview · Drag to tilt"}
          </small>
        </div>,
        document.body
      )}
    </>
  );
}
