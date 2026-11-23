
import {
  useMemo,
  useState
} from "react";

import { toast } from "sonner";

import {
  RefreshCw,
  Search,
  Pencil,
  Check,
  X
} from "lucide-react";

import useAuth from "../hooks/useAuth";

import {
  useApiAction,
  useRecords
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
  toLocalInput,
  validateEntry
} from "../components/ui";

const FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
  "active"
];

export default function RecordsPage() {
  const { user } = useAuth();

  const staff = ["admin", "teacher"].includes(
    user?.role
  );

  const records = useRecords();
  const action = useApiAction();

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    startAt: "",
    endAt: "",
    company: "",
    description: ""
  });

  const entries = records.data || [];

  const counts = Object.fromEntries(
    FILTERS.map(key => [
      key,
      key === "all"
        ? entries.length
        : entries.filter(
            entry => entry.status === key
          ).length
    ])
  );

  const filtered = useMemo(
    () =>
      entries.filter(
        entry =>
          (status === "all" ||
            entry.status === status) &&
          [
            entry.description,
            entry.company,
            entry.user?.name,
            entry.user?.studentNo
          ].some(value =>
            String(value || "")
              .toLowerCase()
              .includes(search.toLowerCase())
          )
      ),
    [entries, status, search]
  );

  const visible = filtered.slice(
    (page - 1) * 10,
    page * 10
  );

  const lastPage = Math.max(
    1,
    Math.ceil(filtered.length / 10)
  );

  function changeFilter(next) {
    setStatus(next);
    setPage(1);
  }

  function correct(entry) {
    setModal({
      type: "correct",
      entry
    });

    setForm({
      startAt: toLocalInput(entry.startAt),
      endAt: toLocalInput(entry.endAt),
      company: entry.company || "",
      description: entry.description || ""
    });
  }

  function review(entry, decision) {
    setReason("");

    setModal({
      type: decision,
      entry
    });
  }

  async function submit(event) {
    event.preventDefault();

    if (!modal) return;

    const { type, entry } = modal;

    try {
      if (type === "correct") {
        const error = validateEntry(form);

        if (error) {
          return toast.error(error);
        }

        await action.mutateAsync({
          path: `/logs/${entry._id}/resubmit`,
          method: "PATCH",
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
      } else {
        if (
          type === "rejected" &&
          reason.trim().length < 5
        ) {
          return toast.error(
            "Provide a rejection reason (5+ characters)."
          );
        }

        await action.mutateAsync({
          path: `/logs/${entry._id}/review`,
          method: "PATCH",
          body: {
            status: type,
            reason:
              type === "rejected"
                ? reason.trim()
                : ""
          }
        });
      }

      toast.success(
        type === "correct"
          ? "Entry resubmitted for review."
          : `Entry ${type}.`
      );

      setModal(null);
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow={
          staff
            ? "VERIFICATION & APPROVALS"
            : "YOUR TRAINING HISTORY"
        }
        title={
          staff
            ? "Review submissions"
            : "My Records"
        }
        description={
          staff
            ? "Make decisions on submitted practicum hours."
            : "All your attendance and manual entries, updated automatically."
        }
        actions={
          <button
            className="btn btn-secondary"
            onClick={() => records.refetch()}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        }
      />

      <Panel
        title="Time entries"
        caption={`${filtered.length} matching records`}
      >
        <div className="records-toolbar">
          <div
            className="status-tabs"
            role="group"
            aria-label="Filter records by status"
          >
            {FILTERS.map(key => (
              <button
                type="button"
                key={key}
                className={
                  status === key ? "selected" : ""
                }
                onClick={() => changeFilter(key)}
              >
                {key.charAt(0).toUpperCase() +
                  key.slice(1)}

                <span>{counts[key]}</span>
              </button>
            ))}
          </div>

          <label className="search-field">
            <Search size={17} />

            <input
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search records..."
              aria-label="Search records"
            />
          </label>
        </div>

        {records.isLoading ? (
          <Loading label="Loading your records..." />
        ) : records.isError ? (
          <ErrorView
            message={records.error.message}
            retry={records.refetch}
          />
        ) : filtered.length === 0 ? (
          <Empty
            title="No records found"
            description="Try another filter or create an attendance entry."
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {staff && (
                      <th>Student</th>
                    )}

                    <th>Date</th>
                    <th>Time</th>
                    <th>Duration</th>
                    <th>Activity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map(entry => (
                    <tr key={entry._id}>
                      {staff && (
                        <td>
                          <strong>
                            {entry.user?.name ||
                              "Student"}
                          </strong>

                          <small>
                            {entry.user?.studentNo}
                          </small>
                        </td>
                      )}

                      <td>
                        {formatDate(entry.startAt)}
                      </td>

                      <td>
                        {formatTime(entry.startAt)}
                        <br />
                        <small>
                          {formatTime(entry.endAt)}
                        </small>
                      </td>

                      <td>
                        {entry.status === "active"
                          ? "In progress"
                          : formatMinutes(
                              entry.minutes
                            )}
                      </td>

                      <td className="activity-cell">
                        <strong>
                          {entry.description ||
                            "Practicum attendance"}
                        </strong>

                        {entry.rejectionReason && (
                          <small className="reason">
                            Reason:{" "}
                            {entry.rejectionReason}
                          </small>
                        )}
                      </td>

                      <td>
                        <Pill status={entry.status} />
                      </td>

                      <td>
                        {staff &&
                        entry.status === "pending" ? (
                          <div className="inline-actions">
                            <button
                              className="small-action success"
                              onClick={() =>
                                review(
                                  entry,
                                  "approved"
                                )
                              }
                              title="Approve"
                            >
                              <Check size={17} />
                            </button>

                            <button
                              className="small-action danger"
                              onClick={() =>
                                review(
                                  entry,
                                  "rejected"
                                )
                              }
                              title="Reject"
                            >
                              <X size={17} />
                            </button>
                          </div>
                        ) : !staff &&
                          entry.status === "rejected" ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              correct(entry)
                            }
                          >
                            <Pencil size={14} />
                            Correct
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>
                Page {page} of {lastPage}
              </span>

              <div>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === 1}
                  onClick={() =>
                    setPage(p => p - 1)
                  }
                >
                  Previous
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === lastPage}
                  onClick={() =>
                    setPage(p => p + 1)
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Modal
        open={Boolean(modal)}
        title={
          modal?.type === "correct"
            ? "Correct rejected record"
            : modal?.type === "approved"
              ? "Approve entry"
              : "Reject entry"
        }
        onClose={() => setModal(null)}
        wide={modal?.type === "correct"}
      >
        {modal && (
          <form
            className="form-grid"
            onSubmit={submit}
          >
            {modal.type === "correct" ? (
              <>
                <label className="field">
                  Start date & time

                  <input
                    type="datetime-local"
                    required
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
                    type="datetime-local"
                    required
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
                  Company

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
                  Activity description

                  <textarea
                    minLength={20}
                    required
                    rows={4}
                    value={form.description}
                    onChange={event =>
                      setForm({
                        ...form,
                        description:
                          event.target.value
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <div className="field-full">
                <p className="subtle">
                  {modal.entry.description}
                  {" · "}
                  {formatMinutes(
                    modal.entry.minutes
                  )}
                </p>

                {modal.type === "rejected" ? (
                  <label className="field">
                    Rejection reason

                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      value={reason}
                      onChange={event =>
                        setReason(
                          event.target.value
                        )
                      }
                      placeholder="Explain what needs to be corrected..."
                    />
                  </label>
                ) : (
                  <p>
                    Approve these hours toward the
                    student's practicum requirement?
                  </p>
                )}
              </div>
            )}

            <div className="modal-actions field-full">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>

              <button
                className={`btn ${
                  modal.type === "rejected"
                    ? "btn-danger"
                    : "btn-primary"
                }`}
                disabled={action.isPending}
              >
                {action.isPending
                  ? "Saving..."
                  : modal.type === "correct"
                    ? "Resubmit entry"
                    : modal.type === "approved"
                      ? "Approve hours"
                      : "Reject entry"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Page>
  );
}