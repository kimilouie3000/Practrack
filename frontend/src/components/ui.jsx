
import { useEffect, useRef } from "react";
import { PRACTICUM_TIME_ZONE } from "../utils/practicumDate";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Inbox,
  LoaderCircle,
  AlertCircle
} from "lucide-react";

export function formatMinutes(value) {
  const minutes = Math.max(
    0,
    Math.floor(Number(value) || 0)
  );

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", {
        timeZone: PRACTICUM_TIME_ZONE,
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

export function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("en-PH", {
        timeZone: PRACTICUM_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit"
      });
}

export function toLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16);
}

export function localDay(date) {
  const parsed = new Date(date);

  const year = parsed.getFullYear();
  const month = String(
    parsed.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    parsed.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function validateEntry(form, options = {}) {
  const start = new Date(form.startAt);
  const end = new Date(form.endAt);

  const minutes = Math.floor(
    (end - start) / 60000
  );

  if (
    !form.startAt ||
    !form.endAt ||
    !Number.isFinite(minutes)
  ) {
    return "Select both dates and times.";
  }

  if (end <= start) {
    return "End time must be after start time.";
  }

  if (!options.allowFuture && end > new Date()) {
    return "You cannot record future hours.";
  }

  if (minutes < 1 || (!options.allowLongDuration && minutes > 720)) {
    return options.allowLongDuration
      ? "End time must be at least one minute after start time."
      : "Hours must be between 1 minute and 12 hours.";
  }

  if (!options.allowMultipleDays && localDay(start) !== localDay(end)) {
    return "Start and end must be on the same day.";
  }

  if ((form.description || "").trim().length < 20) {
    return "Describe your activities in at least 20 characters.";
  }

  return "";
}

export function Page({ children }) {
  return (
    <motion.div
      className="page-stack"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
    >
      {children}
    </motion.div>
  );
}

export function Heading({
  eyebrow,
  title,
  description,
  actions
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtle">{description}</p>
      </div>

      {actions && (
        <div className="heading-actions">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  caption,
  action,
  children,
  className = ""
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>

          {caption && (
            <p className="subtle">{caption}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

export function Metric({
  icon: Icon,
  label,
  value,
  helper,
  emphasis
}) {
  return (
    <article
      className={`metric ${
        emphasis ? "metric-featured" : ""
      }`}
    >
      <div className="metric-top">
        <span className="metric-icon">
          <Icon size={20} />
        </span>

        <span>{label}</span>
      </div>

      <strong className="metric-value">
        {value}
      </strong>

      <p>{helper}</p>
    </article>
  );
}

export function Pill({ status }) {
  return (
    <span className={`pill pill-${status || "unknown"}`}>
      {status || "Unknown"}
    </span>
  );
}

export function Loading({ label = "Loading..." }) {
  return (
    <div className="state-message">
      <LoaderCircle className="spin" size={23} />
      <span>{label}</span>
    </div>
  );
}

export function Empty({
  title = "Nothing here yet",
  description
}) {
  return (
    <div className="state-message">
      <Inbox size={28} />
      <strong>{title}</strong>

      {description && (
        <span>{description}</span>
      )}
    </div>
  );
}

export function ErrorView({ message, retry }) {
  return (
    <div className="state-message">
      <AlertCircle size={27} />
      <strong>Unable to load data</strong>
      <span>{message}</span>

      {retry && (
        <button
          className="btn btn-secondary"
          onClick={retry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ) || []).filter(element => element.getClientRects().length > 0);

    // Start at the close button, and keep Tab cycling within the modal.
    const firstFocus = dialog?.querySelector('button[aria-label="Close dialog"]');
    firstFocus?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.section
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`modal-card ${
              wide ? "modal-wide" : ""
            }`}
            initial={{
              opacity: 0,
              y: 20,
              scale: 0.98
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1
            }}
            exit={{
              opacity: 0,
              y: 12,
              scale: 0.98
            }}
            transition={{ duration: 0.18 }}
          >
            <header className="modal-heading">
              <h2>{title}</h2>

              <button
                type="button"
                className="icon-btn"
                aria-label="Close dialog"
                onClick={onClose}
              >
                <X size={19} />
              </button>
            </header>

            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
