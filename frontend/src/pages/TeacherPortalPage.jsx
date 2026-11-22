import { useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import SkyOverview from "../components/skyview/SkyOverview";
import { toast } from "sonner";
import { usePortalAction, usePortalQuery } from "../hooks/usePortal";
import { Page, Heading, Panel, Loading, ErrorView, Empty, formatMinutes, formatDate, toLocalInput } from "../components/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
}

function Submit({ busy, children }) {
  return <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : children}</button>;
}

function StudentRows({ students, select }) {
  return <div className="portal-list">
    {students.map(student => <button className="portal-row" key={student._id} type="button" onClick={() => select(student._id)}>
      <strong>{student.name}</strong><span>{student.studentNo} · {formatMinutes(student.approvedMinutes)} approved</span>
      <span>{formatMinutes(student.remainingMinutes)} remaining</span>
    </button>)}
  </div>;
}

function TeacherStudents({ students }) {
  const [selected, setSelected] = useState("");
  const details = usePortalQuery(selected ? `/teacher/students/${selected}` : "", Boolean(selected));
  return <>
    <Panel title="Assigned students" caption="Choose a student to inspect their schedule and progress.">
      {students.length ? <StudentRows students={students} select={setSelected} /> : <Empty title="No assigned students" description="Ask an administrator to assign students to you." />}
    </Panel>
    {selected && <Panel title="Student profile and records">
      {details.isLoading ? <Loading label="Loading student details..." /> : details.isError ? <ErrorView message={details.error.message} retry={details.refetch} /> : <>
        <p><strong>{details.data.student.name}</strong> · {details.data.student.studentNo}</p>
        <p>{details.data.student.email} · {details.data.student.company || "No host company"}</p>
        <p><strong>{formatMinutes(details.data.approvedMinutes)}</strong> approved · {formatMinutes(details.data.remainingMinutes)} remaining</p>
        <h3>Schedules</h3>
        <div className="portal-list">{details.data.schedules.length ? details.data.schedules.map(schedule => <div className="portal-row" key={schedule._id}>
          {schedule.date || DAYS[schedule.dayOfWeek]}, {schedule.startTime}–{schedule.endTime}: {schedule.subject}
        </div>) : <p>No schedule has been assigned.</p>}</div>
        <h3>Attendance</h3>
        <div className="portal-list">{details.data.records.length ? details.data.records.map(entry => <div className="portal-row" key={entry._id}>
          {formatDate(entry.startAt)} · {formatMinutes(entry.minutes)} · {entry.status}
        </div>) : <p>No attendance entries yet.</p>}</div>
      </>}
    </Panel>}
  </>;
}

function HoursReview() {
  const records = usePortalQuery("/teacher/records");
  const action = usePortalAction();
  const [reasons, setReasons] = useState({});
  if (records.isLoading) return <Loading label="Loading assigned student hours..." />;
  if (records.isError) return <ErrorView message={records.error.message} retry={records.refetch} />;
  const pending = (records.data.records || []).filter(e => e.status === "pending");
  async function decide(entry, status) {
    const reason = String(reasons[entry._id] || "").trim();
    if (status === "rejected" && reason.length < 5) return toast.error("Enter a rejection reason of at least 5 characters.");
    try {
      await action.mutateAsync({ path: `/teacher/records/${entry._id}/review`, method: "PATCH", body: { status, reason } });
      toast.success(`Record ${status}.`);
    } catch (error) { toast.error(error.message); }
  }
  return <Panel title="Pending hour approvals" caption="Only assigned students appear here. Teachers cannot edit time values.">
    {pending.length ? <div className="portal-list">{pending.map(entry => <div className="portal-row" key={entry._id}>
      <strong>{entry.user?.name || "Student"}</strong>
      <span>{formatDate(entry.startAt)} · {formatMinutes(entry.minutes)}</span>
      <p>{entry.description}</p>
      <Field label="Reason if rejecting"><input value={reasons[entry._id] || ""} maxLength={300} onChange={e => setReasons(old => ({ ...old, [entry._id]: e.target.value }))} placeholder="Reason for rejection" /></Field>
      <div className="portal-actions"><button className="btn btn-primary" disabled={action.isPending} onClick={() => decide(entry, "approved")}>Approve</button>
      <button className="btn btn-secondary" disabled={action.isPending} onClick={() => decide(entry, "rejected")}>Reject</button></div>
    </div>)}</div> : <Empty title="No pending hours" description="Assigned student submissions will appear here." />}
  </Panel>;
}

function Evaluations({ students }) {
  const list = usePortalQuery("/teacher/evaluations");
  const action = usePortalAction();
  const [form, setForm] = useState({ studentId: "", rating: "5", remarks: "", date: new Date().toISOString().slice(0, 10) });
  async function save(event) {
    event.preventDefault();
    try {
      await action.mutateAsync({ path: "/teacher/evaluations", body: form });
      toast.success("Evaluation recorded.");
      setForm(old => ({ ...old, remarks: "" }));
    } catch (error) { toast.error(error.message); }
  }
  return <>
    <Panel title="Write an evaluation" caption="Only students assigned to you can be evaluated.">
      <form className="portal-form" onSubmit={save}>
        <Field label="Student"><select required value={form.studentId} onChange={e => setForm(old => ({ ...old, studentId: e.target.value }))}>
          <option value="">Choose student</option>{students.map(student => <option key={student._id} value={student._id}>{student.name}</option>)}</select></Field>
        <Field label="Rating (1–5)"><select value={form.rating} onChange={e => setForm(old => ({ ...old, rating: e.target.value }))}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></Field>
        <Field label="Evaluation date"><input type="date" required value={form.date} onChange={e => setForm(old => ({ ...old, date: e.target.value }))} /></Field>
        <Field label="Remarks"><textarea required minLength={10} maxLength={1000} rows={3} value={form.remarks} onChange={e => setForm(old => ({ ...old, remarks: e.target.value }))} placeholder="Write at least 10 characters." /></Field>
        <Submit busy={action.isPending}>Save evaluation</Submit>
      </form>
    </Panel>
    <Panel title="Evaluation history">
      {list.isLoading ? <Loading label="Loading evaluations..." /> : list.isError ? <ErrorView message={list.error.message} retry={list.refetch} /> :
        (list.data.evaluations || []).length ? <div className="portal-list">{list.data.evaluations.map(e => <div className="portal-row" key={e._id}>
          <strong>{e.student?.name} · {e.rating}/5</strong><span>{formatDate(e.date)}</span><p>{e.remarks}</p>
        </div>)}</div> : <Empty title="No evaluations yet" description="Use the form above to record the first evaluation." />}
    </Panel>
  </>;
}

function TeacherRequests({ students }) {
  const list = usePortalQuery("/teacher/requests");
  const action = usePortalAction();
  const [studentId, setStudentId] = useState("");
  const [targetType, setTargetType] = useState("record");
  const [targetId, setTargetId] = useState("");
  const [proposed, setProposed] = useState({});
  const [reason, setReason] = useState("");
  const details = usePortalQuery(studentId ? `/teacher/students/${studentId}` : "", Boolean(studentId));
  const items = targetType === "record" ? (details.data?.records || []).filter(r => r.status !== "active") : details.data?.schedules || [];
  const selected = items.find(e => e._id === targetId);
  const defaults = useMemo(() => {
    if (!selected) return {};
    return targetType === "record" ? {
      startAt: toLocalInput(selected.startAt), endAt: toLocalInput(selected.endAt),
      description: selected.description, company: selected.company || ""
    } : {
      date: selected.date || "", dayOfWeek: String(selected.dayOfWeek), startTime: selected.startTime,
      endTime: selected.endTime, subject: selected.subject,
      room: selected.room || "", instructor: selected.instructor || ""
    };
  }, [selected, targetType]);
  const fields = { ...defaults, ...proposed };
  const update = (field, value) => setProposed(old => ({ ...old, [field]: value }));
  async function submit(event) {
    event.preventDefault();
    if (!selected) return toast.error("Choose a time entry or schedule item.");
    try {
      const values = targetType === "record" ? {
        ...fields,
        startAt: new Date(fields.startAt).toISOString(), endAt: new Date(fields.endAt).toISOString()
      } : fields;
      await action.mutateAsync({ path: "/teacher/requests", body: { studentId, targetId, targetType, proposed: values, reason } });
      toast.success("Adjustment requested. An admin will review it.");
      setTargetId(""); setProposed({}); setReason("");
    } catch (error) { toast.error(error.message); }
  }
  return <>
    <Panel title="Request an adjustment" caption="Teachers propose changes; only an administrator can apply them.">
      <form className="portal-form" onSubmit={submit}>
        <Field label="Student"><select required value={studentId} onChange={e => { setStudentId(e.target.value); setTargetId(""); setProposed({}); }}>
          <option value="">Choose student</option>{students.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}</select></Field>
        <Field label="Target type"><select value={targetType} onChange={e => { setTargetType(e.target.value); setTargetId(""); setProposed({}); }}>
          <option value="record">Time entry</option><option value="schedule">Schedule</option></select></Field>
        {details.isError && <p role="alert">{details.error.message}</p>}
        <Field label="Record or schedule"><select required value={targetId} onChange={e => { setTargetId(e.target.value); setProposed({}); }}>
          <option value="">Choose existing item</option>{items.map(item => <option key={item._id} value={item._id}>
            {targetType === "record" ? `${formatDate(item.startAt)} · ${formatMinutes(item.minutes)} (${item.status})` : `${DAYS[item.dayOfWeek]} ${item.startTime} ${item.subject}`}
          </option>)}</select></Field>
        {selected && (targetType === "record" ? <>
          <Field label="Proposed start"><input required type="datetime-local" value={fields.startAt || ""} onChange={e => update("startAt", e.target.value)} /></Field>
          <Field label="Proposed end"><input required type="datetime-local" value={fields.endAt || ""} onChange={e => update("endAt", e.target.value)} /></Field>
          <Field label="Description"><textarea required minLength={20} rows={2} value={fields.description || ""} onChange={e => update("description", e.target.value)} /></Field>
          <Field label="Company"><input value={fields.company || ""} onChange={e => update("company", e.target.value)} /></Field>
        </> : <>
          <Field label="Specific date (optional)"><input type="date" value={fields.date || ""} onChange={e => update("date", e.target.value)} /></Field>
          <Field label="Day"><select value={fields.dayOfWeek} onChange={e => update("dayOfWeek", e.target.value)}>{DAYS.map((name,n) => <option key={name} value={n}>{name}</option>)}</select></Field>
          <Field label="Start time"><input required type="time" value={fields.startTime || ""} onChange={e => update("startTime", e.target.value)} /></Field>
          <Field label="End time"><input required type="time" value={fields.endTime || ""} onChange={e => update("endTime", e.target.value)} /></Field>
          <Field label="Subject"><input required value={fields.subject || ""} onChange={e => update("subject", e.target.value)} /></Field>
          <Field label="Room"><input value={fields.room || ""} onChange={e => update("room", e.target.value)} /></Field>
          <Field label="Instructor"><input value={fields.instructor || ""} onChange={e => update("instructor", e.target.value)} /></Field>
        </>)}
        <Field label="Reason for adjustment"><textarea required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} rows={3} /></Field>
        <Submit busy={action.isPending}>Submit request</Submit>
      </form>
    </Panel>
    <Panel title="My request history">
      {list.isLoading ? <Loading label="Loading requests..." /> : list.isError ? <ErrorView message={list.error.message} retry={list.refetch} /> :
        (list.data.requests || []).length ? <div className="portal-list">{list.data.requests.map(item => <div className="portal-row" key={item._id}>
          <strong>{item.student?.name || "Student"} · {item.targetType} · {item.status}</strong>
          <span>{formatDate(item.createdAt)}</span><p>{item.reason}</p>{item.decisionNote && <p>Admin: {item.decisionNote}</p>}
        </div>)}</div> : <Empty title="No requests submitted" description="Use the form above to submit your first adjustment request." />}
    </Panel>
  </>;
}

export default function TeacherPortalPage({ section = "overview" }) {
  const { user } = useAuth();
  const summary = usePortalQuery("/teacher/overview");
  const recentRecords = usePortalQuery("/teacher/records", section === "overview");
  if (summary.isLoading) return <Loading label="Loading teacher workspace..." />;
  if (summary.isError) return <ErrorView message={summary.error.message} retry={summary.refetch} />;
  const students = summary.data.students || [];
  const names = { overview: "Teacher overview", students: "My students", hours: "Hours review", evaluations: "Evaluations", requests: "My adjustment requests" };
  return <Page>
    {section !== "overview" && <Heading eyebrow="TEACHER WORKSPACE" title={names[section]} description="Review assigned practicum students and submit changes for administrator approval." />}
    {section === "overview" && <>
      <SkyOverview role="teacher" name={user?.name || "Teacher"} approvedMinutes={summary.data.approvedMinutes || 0} pendingCount={summary.data.pendingCount ?? null} rejectedCount={null} entries={recentRecords.data?.records || []} people={students} dataNote="Recent records for your assigned students" />
      <TeacherStudents students={students} />
    </>}
    {section === "students" && <TeacherStudents students={students} />}
    {section === "hours" && <HoursReview />}
    {section === "evaluations" && <Evaluations students={students} />}
    {section === "requests" && <TeacherRequests students={students} />}
  </Page>;
}