import { useState } from "react";
import { toast } from "sonner";
import { Page, Heading, Panel, Loading, ErrorView, Empty, formatDate } from "../components/ui";
import { usePortalAction, usePortalQuery } from "../hooks/usePortal";

function Detail({ value }) {
  if (!value) return <em>Not available</em>;
  return <dl className="portal-detail">{Object.entries(value).filter(([key]) => key !== "__v").map(([key, val]) =>
    <div key={key}><dt>{key}</dt><dd>{val instanceof Object ? JSON.stringify(val) : String(val ?? "—")}</dd></div>
  )}</dl>;
}

export default function AdminRequestsPage() {
  const list = usePortalQuery("/admin/adjustment-requests");
  const action = usePortalAction();
  const [notes, setNotes] = useState({});
  async function decide(request, status) {
    const note = String(notes[request._id] || "").trim();
    if (note.length < 5) return toast.error("Enter a decision note of at least 5 characters.");
    try {
      await action.mutateAsync({ path: `/admin/adjustment-requests/${request._id}/decision`, method: "PATCH", body: { status, note } });
      toast.success(`Request ${status}.`);
    } catch (error) { toast.error(error.message); }
  }
  if (list.isLoading) return <Loading label="Loading adjustment requests..." />;
  if (list.isError) return <ErrorView message={list.error.message} retry={list.refetch} />;
  const requests = list.data.requests || [];
  return <Page>
    <Heading eyebrow="ADMINISTRATION / REQUESTS" title="Adjustment requests" description="Compare proposed changes with original values, then approve or reject with a note." />
    <Panel title="Teacher-submitted requests">
      {requests.length ? <div className="portal-list">{requests.map(request => <section className="portal-row" key={request._id}>
        <strong>{request.student?.name || "Student"} · {request.targetType} · {request.status}</strong>
        <span>Requested by {request.teacher?.name || "Teacher"} on {formatDate(request.createdAt)}</span>
        <p><strong>Reason:</strong> {request.reason}</p>
        {request.targetType === "record" && request.proposed?.hourOverride === true && <p>
          <strong>Credited hours requested:</strong>{" "}
          {Number(request.before?.minutes || 0) / 60} h → {Number(request.proposed.minutes || 0) / 60} h
          <span> (Admin approval required; no changes made yet)</span>
        </p>}
        <div className="portal-columns">
          <div><h3>Current / Original</h3><Detail value={request.before} /></div>
          <div><h3>Proposed</h3><Detail value={request.proposed} /></div>
        </div>
        {request.status === "pending" ? <>
          <label className="field">Decision note<textarea minLength={5} maxLength={1000} rows={2} value={notes[request._id] || ""} onChange={e => setNotes(old => ({ ...old, [request._id]: e.target.value }))} /></label>
          <div className="portal-actions">
            <button className="btn btn-primary" disabled={action.isPending} onClick={() => decide(request, "approved")}>Approve and apply</button>
            <button className="btn btn-secondary" disabled={action.isPending} onClick={() => decide(request, "rejected")}>Reject</button>
          </div>
        </> : <p><strong>Decision:</strong> {request.decisionNote || "No note"}</p>}
      </section>)}</div> : <Empty title="No adjustment requests" description="Requests from assigned teachers will appear here." />}
    </Panel>
  </Page>;
}