
import {
  useCallback,
  useEffect,
  useState
} from "react";
import {
  CalendarDays,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../api/client";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const BLANK_FORM = {
  userId: "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "17:00",
  subject: "",
  room: "",
  instructor: ""
};

export default function SchedulePanel({
  token,
  isStaff,
  students = []
}) {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) return;

      if (!silent) setLoading(true);

      try {
        const data = await apiRequest(
          "/schedule",
          {},
          token
        );

        setSchedules(data.schedules || []);
      } catch (error) {
        if (!silent) toast.error(error.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [load]);

  function update(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...BLANK_FORM });
  }

  function editSchedule(schedule) {
    setEditingId(schedule._id);

    setForm({
      userId: schedule.user?._id || schedule.user || "",
      dayOfWeek: String(schedule.dayOfWeek),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      subject: schedule.subject,
      room: schedule.room || "",
      instructor: schedule.instructor || ""
    });

    document.getElementById("schedule-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function save(event) {
    event.preventDefault();

    if (busy) return;

    if (form.endTime <= form.startTime) {
      toast.error("End time must be after start time.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest(
        editingId
          ? `/schedule/${editingId}`
          : "/schedule",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify(form)
        },
        token
      );

      toast.success(
        editingId
          ? "Schedule updated."
          : "Schedule created."
      );

      cancelEdit();
      await load({ silent: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Remove this schedule?")) return;

    setBusy(true);

    try {
      await apiRequest(
        `/schedule/${id}`,
        { method: "DELETE" },
        token
      );

      if (editingId === id) {
        cancelEdit();
      }

      toast.success("Schedule removed.");
      await load({ silent: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card" id="schedule">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            PRACTICUM SCHEDULE
          </span>

          <h2>Weekly schedule</h2>

          <p>
            {isStaff
              ? "Assign, edit, or remove practicum schedules."
              : "View your assigned practicum sessions."}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading || busy}
          onClick={() => load()}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {isStaff && (
        <form
          className="entry-form schedule-form"
          id="schedule-form"
          onSubmit={save}
        >
          <label className="field-label">
            Student

            <select
              required
              value={form.userId}
              onChange={event =>
                update("userId", event.target.value)
              }
            >
              <option value="">
                Choose a student
              </option>

              {students.map(student => (
                <option
                  key={student._id}
                  value={student._id}
                >
                  {student.name} ({student.studentNo})
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Day

            <select
              value={form.dayOfWeek}
              onChange={event =>
                update("dayOfWeek", event.target.value)
              }
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Start time

            <input
              required
              type="time"
              value={form.startTime}
              onChange={event =>
                update("startTime", event.target.value)
              }
            />
          </label>

          <label className="field-label">
            End time

            <input
              required
              type="time"
              value={form.endTime}
              onChange={event =>
                update("endTime", event.target.value)
              }
            />
          </label>

          <label className="field-label">
            Activity / Subject

            <input
              required
              minLength={2}
              maxLength={120}
              placeholder="Training activity"
              value={form.subject}
              onChange={event =>
                update("subject", event.target.value)
              }
            />
          </label>

          <label className="field-label">
            Room / Location

            <input
              maxLength={120}
              placeholder="Optional"
              value={form.room}
              onChange={event =>
                update("room", event.target.value)
              }
            />
          </label>

          <label className="field-label field-full">
            Instructor / Supervisor

            <input
              maxLength={120}
              placeholder="Optional"
              value={form.instructor}
              onChange={event =>
                update("instructor", event.target.value)
              }
            />
          </label>

          <div className="field-full form-actions">
            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={cancelEdit}
              >
                Cancel edit
              </button>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={busy}
            >
              {busy
                ? "Saving..."
                : editingId
                  ? "Update schedule"
                  : "Add schedule"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">
          <div className="loader-spinner" />
          <p>Loading schedule...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={28} />
          <p>No practicum schedule assigned yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isStaff && <th>Student</th>}
                <th>Day</th>
                <th>Time</th>
                <th>Activity</th>
                <th>Location</th>
                <th>Supervisor</th>
                {isStaff && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {schedules.map(item => (
                <tr key={item._id}>
                  {isStaff && (
                    <td>
                      {item.user?.name || "Student"}
                    </td>
                  )}

                  <td>{DAYS[item.dayOfWeek]}</td>

                  <td>
                    {item.startTime} – {item.endTime}
                  </td>

                  <td>{item.subject}</td>
                  <td>{item.room || "—"}</td>
                  <td>{item.instructor || "—"}</td>

                  {isStaff && (
                    <td>
                      <div className="review-actions">
                        <button
                          type="button"
                          disabled={busy}
                          className="secondary-button"
                          onClick={() => editSchedule(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          className="reject-button"
                          onClick={() => remove(item._id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
