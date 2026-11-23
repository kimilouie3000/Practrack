import { usePracTrackSettings } from "../hooks/useSettings";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  CalendarDays
} from "lucide-react";

import {
  useAdminStudents,
  useAdminStudent,
  useAdminAction
} from "../hooks/useAdmin";

import {
  Page,
  Heading,
  Panel,
  Modal,
  Pill,
  Loading,
  ErrorView,
  Empty,
  formatMinutes,
  formatDate,
  formatTime
} from "../components/ui";

const FIELDS = [
  "school",
  "course",
  "yearLevel",
  "section",
  "phone",
  "address",
  "bio"
];

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function studentForm(student) {
  return {
    name: student?.name || "",
    email: student?.email || "",
    studentNo: student?.studentNo || "",
    password: "",
    requiredHours: student?.requiredMinutesOverride != null
      ? String(student.requiredMinutesOverride / 60) : "",
    targetChangeReason: "",
    company: student?.company || "",
    active: student?.active !== false,
    profile: Object.fromEntries(
      FIELDS.map(key => [
        key,
        student?.profile?.[key] || ""
      ])
    )
  };
}

function StudentDetail({ id, onClose, onEdit }) {
  const detail = useAdminStudent(id);
  const settings = usePracTrackSettings();
  const requiredMinutes = detail.data?.requiredMinutes ?? settings.data?.requiredMinutes ?? 400 * 60;

  return (
    <Modal
      open={Boolean(id)}
      wide
      title="Student details"
      onClose={onClose}
    >
      {detail.isLoading ? (
        <Loading label="Loading student records..." />
      ) : detail.isError ? (
        <ErrorView
          message={detail.error.message}
          retry={detail.refetch}
        />
      ) : detail.data ? (
        <div className="admin-detail">
          <div className="admin-detail-heading">
            <div>
              <h3>{detail.data.student.name}</h3>
              <p className="subtle">
                {detail.data.student.studentNo}
                {" · "}
                {detail.data.student.email}
              </p>
            </div>

            <span
              className={`pill ${
                detail.data.student.active
                  ? "pill-approved"
                  : "pill-rejected"
              }`}
            >
              {detail.data.student.active
                ? "Active"
                : "Inactive"}
            </span>
          </div>

          <div className="admin-summary-pair">
            <div>
              <small>Approved</small>
              <strong>
                {formatMinutes(
                  detail.data.approvedMinutes
                )}
              </strong>
            </div>

            <div>
              <small>Remaining</small>
              <strong>
                {formatMinutes(
                  detail.data.remainingMinutes
                )}
              </strong>
            </div>
          </div>

          <div className="admin-progress-bar">
            <span
              style={{
                width: `${Math.min(
                  100,
                  detail.data.approvedMinutes /
                    requiredMinutes * 100
                )}%`
              }}
            />
          </div>

          <p className="subtle">Required: {formatMinutes(requiredMinutes)}</p>

          <h4>Student profile</h4>

          <div className="admin-properties">
            {[
              ["School", "school"],
              ["Course", "course"],
              ["Year", "yearLevel"],
              ["Section", "section"],
              ["Phone", "phone"]
            ].map(([label, key]) => (
              <div key={key}>
                <small>{label}</small>
                <strong>
                  {detail.data.student.profile?.[key] ||
                    "—"}
                </strong>
              </div>
            ))}
          </div>

          <h4>Weekly schedule</h4>

          {detail.data.schedules.length ? (
            <div className="admin-mini-list">
              {detail.data.schedules.map(item => (
                <div key={item._id}>
                  <CalendarDays size={15} />
                  <span>
                    {DAYS[item.dayOfWeek]}
                    {" · "}
                    {item.startTime}–{item.endTime}
                    {" · "}
                    {item.subject}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="subtle">
              No assigned schedule.
            </p>
          )}

          <h4>Attendance history</h4>

          {detail.data.records.length ? (
            <div className="admin-mini-list">
              {detail.data.records.slice(0, 15).map(
                item => (
                  <div key={item._id}>
                    <span>
                      {formatDate(item.startAt)}
                      {" · "}
                      {formatTime(item.startAt)}
                      {" · "}
                      {formatMinutes(item.minutes)}
                    </span>
                    <Pill status={item.status} />
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="subtle">
              No attendance records.
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Close
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onEdit(detail.data.student)
              }
            >
              Edit student
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export default function AdminStudentsPage() {
  const studentsQuery = useAdminStudents();
  const settings = usePracTrackSettings();
  const defaultRequiredMinutes = settings.data?.requiredMinutes || 400 * 60;
  const mutation = useAdminAction();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(studentForm());

  const students = studentsQuery.data || [];

  const filtered = useMemo(() => {
    return students.filter(student => {
      const statusMatches =
        filter === "all" ||
        (filter === "active"
          ? student.active
          : !student.active);

      const textMatches = [
        student.name,
        student.email,
        student.studentNo,
        student.profile?.course
      ].some(value =>
        String(value || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      );

      return statusMatches && textMatches;
    });
  }, [students, filter, search]);

  function openForm(student = null) {
    setSelected(null);
    setEditing(student?._id || "new");
    setForm(studentForm(student));
  }

  function updateProfile(field, value) {
    setForm(current => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: value
      }
    }));
  }

  async function save(event) {
    event.preventDefault();

    if (
      editing === "new" &&
      form.password.length < 12
    ) {
      toast.error(
        "Password must have at least 12 characters."
      );
      return;
    }

    try {
      const result = await mutation.mutateAsync({
        path:
          editing === "new"
            ? "/admin/students"
            : `/admin/students/${editing}`,
        method:
          editing === "new" ? "POST" : "PATCH",
        body: form
      });

      toast.success(
        editing === "new"
          ? "Student created."
          : "Student updated."
      );

      setEditing(null);
      setSelected(result.student._id);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function remove(student) {
    const confirmed = window.confirm(
      `Archive ${student.name}? Their attendance, evaluations, and history will be preserved.`
    );

    if (!confirmed) return;

    try {
      await mutation.mutateAsync({
        path: `/admin/students/${student._id}`,
        method: "DELETE"
      });

      toast.success(
        "Student archived. Records were preserved."
      );

      if (selected === student._id) {
        setSelected(null);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function restore(student) {
    try {
      await mutation.mutateAsync({ path: `/admin/students/${student._id}/restore`, method: "PATCH" });
      toast.success("Student restored.");
    } catch (error) { toast.error(error.message); }
  }

  return (
    <Page>
      <Heading
        eyebrow="ADMINISTRATION / STUDENTS"
        title="Student management"
        description="Create accounts and manage every student's profile, hours, attendance, and schedule."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => openForm()}
          >
            <Plus size={17} />
            Add student
          </button>
        }
      />

      <Panel
        title="Registered students"
        caption={`${filtered.length} students shown`}
      >
        <div className="filter-row">
          <label className="search-field admin-search">
            <Search size={17} />

            <input
              value={search}
              placeholder="Search name, ID, email or course..."
              onChange={event =>
                setSearch(event.target.value)
              }
            />
          </label>

          <select
            aria-label="Account status"
            value={filter}
            onChange={event =>
              setFilter(event.target.value)
            }
          >
            <option value="active">
              Active accounts
            </option>
            <option value="inactive">
              Inactive accounts
            </option>
            <option value="all">
              All accounts
            </option>
          </select>
        </div>

        {studentsQuery.isLoading ? (
          <Loading label="Loading students..." />
        ) : studentsQuery.isError ? (
          <ErrorView
            message={studentsQuery.error.message}
            retry={studentsQuery.refetch}
          />
        ) : !filtered.length ? (
          <Empty
            title="No students found"
            description="Create a student account or adjust the filters."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name / ID</th>
                  <th>Course / School</th>
                  <th>Approved hours</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(student => (
                  <tr key={student._id}>
                    <td>
                      <strong>{student.name}</strong>
                      <small>
                        {student.studentNo}
                        {" · "}
                        {student.email}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {student.profile?.course || "—"}
                      </strong>
                      <small>
                        {student.profile?.school || "—"}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {formatMinutes(
                          student.approvedMinutes
                        )}
                      </strong>
                      <small>
                        {Math.round(
                          student.approvedMinutes /
                            (student.requiredMinutes || defaultRequiredMinutes) * 100
                        )}% of {(student.requiredMinutes || defaultRequiredMinutes) / 60} hours
                      </small>
                    </td>

                    <td>{student.pendingCount}</td>

                    <td>
                      <span
                        className={`pill ${
                          student.active
                            ? "pill-approved"
                            : "pill-rejected"
                        }`}
                      >
                        {student.active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setSelected(student._id)
                          }
                        >
                          <Eye size={14} />
                          View
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            openForm(student)
                          }
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        {student.active ? <button
                          type="button"
                          title="Archive student"
                          className="btn btn-danger-soft btn-sm"
                          disabled={mutation.isPending}
                          onClick={() =>
                            remove(student)
                          }
                        >
                          <Trash2 size={14} />
                        </button> : <button type="button" className="btn btn-secondary btn-sm" onClick={() => restore(student)} disabled={mutation.isPending}>Restore</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <StudentDetail
        id={selected}
        onClose={() => setSelected(null)}
        onEdit={openForm}
      />

      <Modal
        open={Boolean(editing)}
        wide
        title={
          editing === "new"
            ? "Create student account"
            : "Edit student account"
        }
        onClose={() => setEditing(null)}
      >
        <form
          className="form-grid"
          onSubmit={save}
        >
          <label className="field">
            Full name
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={event =>
                setForm({
                  ...form,
                  name: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={event =>
                setForm({
                  ...form,
                  email: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            Student number
            <input
              required
              pattern="[0-9]{4}-[0-9]{5}"
              placeholder="2023-00001"
              value={form.studentNo}
              onChange={event =>
                setForm({
                  ...form,
                  studentNo: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            {editing === "new"
              ? "Initial password"
              : "New password (optional)"}
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required={editing === "new"}
              value={form.password}
              onChange={event =>
                setForm({
                  ...form,
                  password: event.target.value
                })
              }
            />
          </label>

          <label className="field">
            Required practicum hours (Admin only)
            <input
              type="number"
              min="0.0166666667"
              step="any"
              placeholder={`System default: ${defaultRequiredMinutes / 60} hours`}
              value={form.requiredHours}
              onChange={event => setForm({
                ...form,
                requiredHours: event.target.value
              })}
            />
            <small>Any positive number; leave blank to use the system default.</small>
          </label>

          <label className="field">
            Reason for target change (audit note)
            <input
              maxLength={300}
              value={form.targetChangeReason}
              onChange={event => setForm({
                ...form,
                targetChangeReason: event.target.value
              })}
            />
          </label>

          <label className="field">
            School
            <input
              value={form.profile.school}
              onChange={event =>
                updateProfile(
                  "school",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Course
            <input
              value={form.profile.course}
              onChange={event =>
                updateProfile(
                  "course",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Year level
            <input
              value={form.profile.yearLevel}
              onChange={event =>
                updateProfile(
                  "yearLevel",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Section
            <input
              value={form.profile.section}
              onChange={event =>
                updateProfile(
                  "section",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Phone
            <input
              value={form.profile.phone}
              onChange={event =>
                updateProfile(
                  "phone",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Training company
            <input
              value={form.company}
              onChange={event =>
                setForm({
                  ...form,
                  company: event.target.value
                })
              }
            />
          </label>

          <label className="field field-full">
            Address
            <input
              value={form.profile.address}
              onChange={event =>
                updateProfile(
                  "address",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field field-full">
            Bio
            <textarea
              rows={2}
              value={form.profile.bio}
              onChange={event =>
                updateProfile(
                  "bio",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field field-full admin-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={event =>
                setForm({
                  ...form,
                  active: event.target.checked
                })
              }
            />
            Account active
          </label>

          <div className="modal-actions field-full">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? "Saving..."
                : "Save student"}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
