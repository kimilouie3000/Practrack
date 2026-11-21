
import { useState } from "react";
import { toast } from "sonner";

import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X
} from "lucide-react";

import {
  useAdminRecords,
  useAdminStudents,
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
  formatTime,
  toLocalInput,
  validateEntry
} from "../components/ui";

const EMPTY = {
  userId: "",
  startAt: "",
  endAt: "",
  description: "",
  company: "",
  status: "pending",
  rejectionReason: ""
};

function editForm(entry) {
  if (!entry) {
    return { ...EMPTY };
  }

  return {
    userId: entry.user?._id || entry.user,
    startAt: toLocalInput(entry.startAt),
    endAt: toLocalInput(entry.endAt),
    description: entry.description || "",
    company: entry.company || "",
    status: entry.status,
    rejectionReason: entry.rejectionReason || ""
  };
}

export default function AdminRecordsPage() {
  const [status, setStatus] = useState("all");
  const [studentId, setStudentId] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(editForm());
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState("");

  const records = useAdminRecords({
    status,
    studentId,
    page
  });

  const students = useAdminStudents();
  const mutation = useAdminAction();

  const entries = records.data?.entries || [];

  function openForm(entry = null) {
    setEditing(entry?._id || "new");
    setForm(editForm(entry));
  }

  function updateForm(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  }

  async function save(event) {
    event.preventDefault();

    const error = validateEntry(form);

    if (error) {
      toast.error(error);
      return;
    }

    if (
      form.status === "rejected" &&
      form.rejectionReason.trim().length < 5
    ) {
      toast.error("A rejection reason is required.");
      return;
    }

    if (!form.userId) {
      toast.error("Select a student.");
      return;
    }

    try {
      await mutation.mutateAsync({
        path:
          editing === "new"
            ? "/admin/records"
            : `/admin/records/${editing}`,
        method:
          editing === "new" ? "POST" : "PATCH",
        body: {
          ...form,
          startAt: new Date(
            form.startAt
          ).toISOString(),
          endAt: new Date(
            form.endAt
          ).toISOString()
        }
      });

      toast.success(
        editing === "new"
          ? "Entry created."
          : "Entry updated."
      );

      setEditing(null);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function decide(event) {
    event.preventDefault();

    if (!review) return;

    if (
      review.status === "rejected" &&
      reason.trim().length < 5
    ) {
      toast.error("Enter a rejection reason.");
      return;
    }

    try {
      await mutation.mutateAsync({
        path:
          `/admin/records/${review.entry._id}/review`,
        method: "PATCH",
        body: {
          status: review.status,
          reason
        }
      });

      toast.success(`Entry ${review.status}.`);
      setReview(null);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function remove(entry) {
    const confirmed = window.confirm(
      "Permanently delete this attendance record?"
    );

    if (!confirmed) return;

    try {
      await mutation.mutateAsync({
        path: `/admin/records/${entry._id}`,
        method: "DELETE"
      });

      toast.success("Record deleted.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="ADMINISTRATION / VERIFICATION"
        title="Hours & approvals"
        description="Review pending entries, filter student attendance, and manage time records."
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => records.refetch()}
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={() => openForm()}
            >
              <Plus size={17} />
              Add entry
            </button>
          </>
        }
      />

      <Panel
        title="Practicum time entries"
        caption={`${records.data?.total ?? 0} matching records`}
      >
        <div className="admin-filters">
          <select
            aria-label="Filter by student"
            value={studentId}
            onChange={event => {
              setStudentId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              All students
            </option>

            {(students.data || []).map(item => (
              <option
                key={item._id}
                value={item._id}
              >
                {item.name} · {item.studentNo}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={status}
            onChange={event => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">
              All statuses
            </option>

            {[
              "active",
              "pending",
              "approved",
              "rejected"
            ].map(item => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </div>

        {records.isLoading ? (
          <Loading label="Loading attendance entries..." />
        ) : records.isError ? (
          <ErrorView
            message={records.error.message}
            retry={records.refetch}
          />
        ) : !entries.length ? (
          <Empty
            title="No entries found"
            description="Adjust filters or create a time entry."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Hours</th>
                  <th>Activities</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {entries.map(entry => (
                  <tr key={entry._id}>
                    <td>
                      <strong>
                        {entry.user?.name ||
                          "Former student"}
                      </strong>
                      <small>
                        {entry.user?.studentNo || "—"}
                      </small>
                    </td>

                    <td>
                      {formatDate(entry.startAt)}
                    </td>

                    <td>
                      {formatTime(entry.startAt)}
                      <small>
                        {formatTime(entry.endAt)}
                      </small>
                    </td>

                    <td>
                      {entry.status === "active"
                        ? "Running"
                        : formatMinutes(entry.minutes)}
                    </td>

                    <td className="activity-cell">
                      <strong>
                        {entry.description}
                      </strong>

                      {entry.rejectionReason && (
                        <small className="reason">
                          {entry.rejectionReason}
                        </small>
                      )}
                    </td>

                    <td>
                      <Pill status={entry.status} />
                    </td>

                    <td>
                      <div className="admin-actions">
                        {entry.status === "pending" && (
                          <>
                            <button
                              type="button"
                              title="Approve"
                              className="small-action success"
                              disabled={mutation.isPending}
                              onClick={() => {
                                setReview({
                                  entry,
                                  status: "approved"
                                });
                                setReason("");
                              }}
                            >
                              <Check size={16} />
                            </button>

                            <button
                              type="button"
                              title="Reject"
                              className="small-action danger"
                              disabled={mutation.isPending}
                              onClick={() => {
                                setReview({
                                  entry,
                                  status: "rejected"
                                });
                                setReason("");
                              }}
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}

                        {entry.status !== "active" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                openForm(entry)
                              }
                            >
                              <Pencil size={14} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger-soft btn-sm"
                              disabled={mutation.isPending}
                              onClick={() =>
                                remove(entry)
                              }
                              title="Delete entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>
            Page {records.data?.page || page}
            {" / "}
            {records.data?.pages || 1}
          </span>

          <div>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() =>
                setPage(value => value - 1)
              }
            >
              Previous
            </button>

            <button
              className="btn btn-secondary btn-sm"
              disabled={
                page >= (records.data?.pages || 1)
              }
              onClick={() =>
                setPage(value => value + 1)
              }
            >
              Next
            </button>
          </div>
        </div>
      </Panel>

      {/* Add / edit record */}
      <Modal
        open={Boolean(editing)}
        wide
        title={
          editing === "new"
            ? "Add student time entry"
            : "Edit student time entry"
        }
        onClose={() => setEditing(null)}
      >
        <form
          className="form-grid"
          onSubmit={save}
        >
          <label className="field field-full">
            Student

            <select
              required
              disabled={editing !== "new"}
              value={form.userId}
              onChange={event =>
                updateForm(
                  "userId",
                  event.target.value
                )
              }
            >
              <option value="">
                Choose student
              </option>

              {(students.data || [])
                .filter(item =>
                  editing !== "new" || item.active
                )
                .map(item => (
                  <option
                    key={item._id}
                    value={item._id}
                  >
                    {item.name} · {item.studentNo}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            Start date & time

            <input
              type="datetime-local"
              required
              value={form.startAt}
              onChange={event =>
                updateForm(
                  "startAt",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            End date & time

            <input
              type="datetime-local"
              required
              value={form.endAt}
              onChange={event =>
                updateForm(
                  "endAt",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field field-full">
            Company

            <input
              maxLength={120}
              value={form.company}
              onChange={event =>
                updateForm(
                  "company",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field field-full">
            Activities

            <textarea
              required
              minLength={20}
              rows={4}
              value={form.description}
              onChange={event =>
                updateForm(
                  "description",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Status

            <select
              value={form.status}
              onChange={event =>
                updateForm(
                  "status",
                  event.target.value
                )
              }
            >
              <option value="pending">
                Pending
              </option>
              <option value="approved">
                Approved
              </option>
              <option value="rejected">
                Rejected
              </option>
            </select>
          </label>

          {form.status === "rejected" && (
            <label className="field field-full">
              Rejection reason

              <textarea
                minLength={5}
                required
                value={form.rejectionReason}
                onChange={event =>
                  updateForm(
                    "rejectionReason",
                    event.target.value
                  )
                }
              />
            </label>
          )}

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
                : "Save record"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve / reject confirmation */}
      <Modal
        open={Boolean(review)}
        title={
          review?.status === "approved"
            ? "Approve practicum hours?"
            : "Reject practicum entry"
        }
        onClose={() => setReview(null)}
      >
        <form
          onSubmit={decide}
          className="form-grid"
        >
          <p className="subtle field-full">
            {review?.entry?.user?.name}
            {" · "}
            {formatMinutes(
              review?.entry?.minutes
            )}
          </p>

          {review?.status === "rejected" && (
            <label className="field field-full">
              Rejection reason

              <textarea
                required
                minLength={5}
                rows={3}
                value={reason}
                onChange={event =>
                  setReason(event.target.value)
                }
              />
            </label>
          )}

          <div className="modal-actions field-full">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReview(null)}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? "Processing..."
                : "Confirm"}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
