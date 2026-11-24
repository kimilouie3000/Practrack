
import {
  useMemo,
  useState
} from "react";

import { Link } from "react-router-dom";
import { toast } from "sonner";

import {
  Clock3,
  Play,
  Square,
  Plus,
  Timer,
  ShieldCheck
} from "lucide-react";

import useAuth from "../hooks/useAuth";
import useTimer from "../hooks/useTimer";
import { practicumDate } from "../utils/practicumDate";

import {
  useApiAction,
  useRecords,
  useProfile
} from "../hooks/usePracTrack";

import {
  Page,
  Heading,
  Panel,
  Modal,
  Pill,
  Loading,
  ErrorView,
  Empty,
  formatDate,
  formatTime,
  formatMinutes,
  validateEntry
} from "../components/ui";

const blank = {
  startAt: "",
  endAt: "",
  company: "",
  description: ""
};

export default function AttendancePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const records = useRecords();
  const action = useApiAction();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const student = user?.role === "student";
  const entries = records.data || [];

  const active = entries.find(
    item => item.status === "active"
  );

  const {
    formatted,
    elapsedSeconds
  } = useTimer(
    active?.startAt,
    Boolean(active)
  );

  const todayEntries = useMemo(
    () =>
      entries.filter(
        item =>
          item.startAt &&
          practicumDate(item.startAt) ===
            practicumDate(new Date())
      ),
    [entries]
  );

  async function clock(type) {
    if (
      type === "clock-out" &&
      !window.confirm(
        "Clock out and submit this session for approval?"
      )
    ) {
      return;
    }

    try {
      const result = await action.mutateAsync({
        path: `/logs/${type}`
      });

      if (result.entry?.status === "rejected") {
        toast.error(
          result.entry.rejectionReason ||
            "Session rejected."
        );
      } else {
        toast.success(
          type === "clock-in"
            ? "You are now clocked in."
            : "Clock-out submitted for review."
        );
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function manual(event) {
    event.preventDefault();

    const error = validateEntry(form);

    if (error) {
      return toast.error(error);
    }

    try {
      await action.mutateAsync({
        path: "/logs",
        body: {
          ...form,
          startAt: new Date(
            form.startAt
          ).toISOString(),
          endAt: new Date(
            form.endAt
          ).toISOString(),
          description: form.description.trim()
        }
      });

      toast.success(
        "Manual entry sent for review."
      );

      setOpen(false);
      setForm(blank);
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="TIME & ATTENDANCE"
        title="Attendance"
        description="Clock in, track active time, and submit missed sessions."
        actions={
          student && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setForm({
                  ...blank,
                  company: profile?.company || ""
                });

                setOpen(true);
              }}
            >
              <Plus size={17} />
              Manual entry
            </button>
          )
        }
      />

      {!student ? (
        <Panel title="Attendance tracking">
          <p className="subtle">
            Only students can clock in or submit attendance.
            Staff can review time entries in the Records page.
          </p>

          <Link
            to="/records"
            className="btn btn-primary"
          >
            Go to records
          </Link>
        </Panel>
      ) : records.isLoading ? (
        <Loading label="Loading attendance..." />
      ) : records.isError ? (
        <ErrorView
          message={records.error.message}
          retry={records.refetch}
        />
      ) : (
        <>
          <section
            className={`clock-panel ${
              active ? "clock-panel-active" : ""
            }`}
          >
            <div>
              <div className="clock-status">
                <span
                  className={
                    active ? "pulse-dot" : "rest-dot"
                  }
                />

                {active
                  ? "SESSION IN PROGRESS"
                  : "READY TO CLOCK IN"}
              </div>

              <h2>
                {active
                  ? "You're on the clock."
                  : "Ready to begin your shift?"}
              </h2>

              <p>
                {active
                  ? `Started ${formatTime(
                      active.startAt
                    )} · ${formatDate(active.startAt)}`
                  : "Your clock-in time is recorded securely by the server."}
              </p>

              <div className="clock-timer">
                <Timer size={22} />

                <strong>
                  {active
                    ? formatted
                    : "00:00:00"}
                </strong>
              </div>

              {active && elapsedSeconds > 43200 && (
                <div className="warning-text">
                  This session exceeds the 12-hour daily
                  limit and may be rejected.
                </div>
              )}
            </div>

            <button
              className={`btn ${
                active
                  ? "btn-danger"
                  : "btn-primary"
              } clock-button`}
              onClick={() =>
                clock(
                  active
                    ? "clock-out"
                    : "clock-in"
                )
              }
              disabled={action.isPending}
            >
              {active ? (
                <>
                  <Square size={17} />
                  Clock out
                </>
              ) : (
                <>
                  <Play size={17} />
                  Clock in
                </>
              )}
            </button>
          </section>

          <div className="two-panels">
            <Panel
              title="Today's activity"
              caption="Sessions recorded today"
            >
              {todayEntries.length ? (
                <div className="activity-list">
                  {todayEntries.map(entry => (
                    <div
                      className="activity-row"
                      key={entry._id}
                    >
                      <span className="activity-dot">
                        <Clock3 size={17} />
                      </span>

                      <div className="activity-name">
                        <strong>
                          {formatTime(entry.startAt)}
                          {" – "}
                          {formatTime(entry.endAt)}
                        </strong>

                        <span>
                          {formatMinutes(entry.minutes)}
                          {" · "}
                          {entry.description}
                        </span>
                      </div>

                      <Pill status={entry.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No activity today"
                  description="Clock in to start a new session."
                />
              )}
            </Panel>

            <Panel
              title="How it works"
              caption="Your attendance verification workflow"
            >
              <div className="steps">
                <div>
                  <span>01</span>

                  <p>
                    <strong>Clock in</strong>
                    <small>
                      Start your attendance session.
                    </small>
                  </p>
                </div>

                <div>
                  <span>02</span>

                  <p>
                    <strong>Clock out</strong>
                    <small>
                      Your recorded time goes to pending review.
                    </small>
                  </p>
                </div>

                <div>
                  <span>03</span>

                  <p>
                    <strong>Get verified</strong>
                    <small>
                      Approved hours count toward completion.
                    </small>
                  </p>
                </div>
              </div>

              <div className="secure-note">
                <ShieldCheck size={18} />
                Timestamps are recorded by the server.
              </div>
            </Panel>
          </div>
        </>
      )}

      <Modal
        open={open}
        title="Add manual time entry"
        onClose={() => setOpen(false)}
        wide
      >
        <form
          className="form-grid"
          onSubmit={manual}
        >
          <label className="field">
            Start date & time

            <input
              required
              type="datetime-local"
              value={form.startAt}
              onChange={event =>
                setForm({
                  ...form,
                  startAt: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            End date & time

            <input
              required
              type="datetime-local"
              value={form.endAt}
              onChange={event =>
                setForm({
                  ...form,
                  endAt: event.target.value
                })
              }
            />
          </label>

          <label className="field field-full">
            Company / Organization

            <input
              value={form.company}
              onChange={event =>
                setForm({
                  ...form,
                  company: event.target.value
                })
              }
              placeholder="Training location"
            />
          </label>

          <label className="field field-full">
            Activities performed

            <textarea
              required
              rows={5}
              minLength={20}
              value={form.description}
              onChange={event =>
                setForm({
                  ...form,
                  description: event.target.value
                })
              }
              placeholder="Describe the training tasks and activities you completed..."
            />

            <small>At least 20 characters.</small>
          </label>

          <div className="modal-actions field-full">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              disabled={action.isPending}
            >
              {action.isPending
                ? "Submitting..."
                : "Submit for review"}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
