
import {
  useMemo,
  useState
} from "react";

import { toast } from "sonner";

import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  RefreshCw
} from "lucide-react";

import useAuth from "../hooks/useAuth";

import {
  useApiAction,
  useSchedules,
  useStudents
} from "../hooks/usePracTrack";

import {
  Page,
  Heading,
  Panel,
  Modal,
  Loading,
  ErrorView,
  Empty
} from "../components/ui";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const blank = {
  userId: "",
  date: "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "17:00",
  subject: "",
  room: "",
  instructor: ""
};

export default function SchedulePage() {
  const { user } = useAuth();

  const staff = user?.role === "admin";

  const schedules = useSchedules();
  const students = useStudents();
  const action = useApiAction();

  const [day, setDay] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);

  const rows = useMemo(
    () =>
      (schedules.data || [])
        .filter(
          item =>
            (day === "all" ||
              String(item.dayOfWeek) === day) &&
            [
              item.subject,
              item.user?.name,
              item.room
            ].some(value =>
              String(value || "")
                .toLowerCase()
                .includes(search.toLowerCase())
            )
        )
        .sort(
          (a, b) =>
            a.dayOfWeek - b.dayOfWeek ||
            a.startTime.localeCompare(b.startTime)
        ),
    [schedules.data, day, search]
  );

  function launch(item = null) {
    setEditing(item?._id || null);

    setForm(
      item
        ? {
            userId:
              item.user?._id || item.user || "",
            date: item.date || "",
            dayOfWeek: String(item.dayOfWeek),
            startTime: item.startTime,
            endTime: item.endTime,
            subject: item.subject || "",
            room: item.room || "",
            instructor: item.instructor || ""
          }
        : { ...blank }
    );

    setOpen(true);
  }

  async function save(event) {
    event.preventDefault();

    if (form.endTime <= form.startTime) {
      return toast.error(
        "End time must be after start time."
      );
    }

    try {
      await action.mutateAsync({
        path: editing
          ? `/schedule/${editing}`
          : "/schedule",
        method: editing ? "PATCH" : "POST",
        body: form
      });

      toast.success(
        editing
          ? "Schedule updated."
          : "Schedule created."
      );

      setOpen(false);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function remove(item) {
    if (
      !window.confirm(
        `Remove ${item.subject} from the schedule?`
      )
    ) {
      return;
    }

    try {
      await action.mutateAsync({
        path: `/schedule/${item._id}`,
        method: "DELETE"
      });

      toast.success("Schedule removed.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="PLANNING & CALENDAR"
        title="Weekly schedule"
        description="Your training timetable, organized by day."
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => schedules.refetch()}
            >
              <RefreshCw size={17} />
              Refresh
            </button>

            {staff && (
              <button
                className="btn btn-primary"
                onClick={() => launch()}
              >
                <Plus size={18} />
                New schedule
              </button>
            )}
          </>
        }
      />

      <Panel
        title="Assigned sessions"
        caption="Use the filters to explore the weekly schedule"
      >
        <div className="filter-row">
          <input
            placeholder="Search activity, room, student..."
            aria-label="Search schedules"
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

          <select
            aria-label="Filter day"
            value={day}
            onChange={event =>
              setDay(event.target.value)
            }
          >
            <option value="all">All days</option>

            {DAYS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {schedules.isLoading ? (
          <Loading label="Loading schedules..." />
        ) : schedules.isError ? (
          <ErrorView
            message={schedules.error.message}
            retry={schedules.refetch}
          />
        ) : rows.length === 0 ? (
          <Empty
            title="No sessions found"
            description="When an instructor assigns a schedule, it will appear here."
          />
        ) : (
          <div className="schedule-grid">
            {rows.map(item => (
              <article
                className="schedule-item"
                key={item._id}
              >
                <div className="schedule-date">
                  <CalendarDays size={16} />
                  {item.date ? `${item.date} (${DAYS[item.dayOfWeek]})` : DAYS[item.dayOfWeek]}
                </div>

                <h3>{item.subject}</h3>

                <p className="schedule-time">
                  {item.startTime} — {item.endTime}
                </p>

                <div className="schedule-meta">
                  {item.room && (
                    <span>{item.room}</span>
                  )}

                  {item.instructor && (
                    <span>{item.instructor}</span>
                  )}

                  {staff && (
                    <span>
                      {item.user?.name || "Student"}
                    </span>
                  )}
                </div>

                {staff && (
                  <div className="card-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => launch(item)}
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    <button
                      className="btn btn-danger-soft btn-sm"
                      disabled={action.isPending}
                      onClick={() => remove(item)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Modal
        open={open}
        title={
          editing
            ? "Edit schedule"
            : "Assign a schedule"
        }
        onClose={() => setOpen(false)}
      >
        <form
          className="form-grid"
          onSubmit={save}
        >
          <label className="field field-full">
            Student

            <select
              required
              value={form.userId}
              onChange={event =>
                setForm({
                  ...form,
                  userId: event.target.value
                })
              }
            >
              <option value="">Select student</option>

              {(students.data || []).map(item => (
                <option
                  key={item._id}
                  value={item._id}
                >
                  {item.name} ({item.studentNo})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Specific date (optional — leave blank for weekly recurrence)
            <input type="date" value={form.date || ""}
              onChange={event => setForm({ ...form, date: event.target.value })} />
          </label>

          <label className="field">
            Day

            <select
              value={form.dayOfWeek}
              onChange={event =>
                setForm({
                  ...form,
                  dayOfWeek: event.target.value
                })
              }
            >
              {DAYS.map((name, i) => (
                <option value={i} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Activity

            <input
              required
              minLength={2}
              maxLength={120}
              value={form.subject}
              onChange={event =>
                setForm({
                  ...form,
                  subject: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            Start time

            <input
              required
              type="time"
              value={form.startTime}
              onChange={event =>
                setForm({
                  ...form,
                  startTime: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            End time

            <input
              required
              type="time"
              value={form.endTime}
              onChange={event =>
                setForm({
                  ...form,
                  endTime: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            Location

            <input
              maxLength={120}
              value={form.room}
              onChange={event =>
                setForm({
                  ...form,
                  room: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            Supervisor

            <input
              maxLength={120}
              value={form.instructor}
              onChange={event =>
                setForm({
                  ...form,
                  instructor: event.target.value
                })
              }
            />
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
                ? "Saving..."
                : "Save schedule"}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}