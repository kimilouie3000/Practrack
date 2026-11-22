import { useState } from "react";
import { toast } from "sonner";
import { Page, Heading, Panel, Loading, ErrorView, Empty } from "../components/ui";
import { usePortalAction, usePortalQuery } from "../hooks/usePortal";

const defaults = { name: "", email: "", password: "", role: "teacher", company: "" };

export default function AdminAccountsPage() {
  const list = usePortalQuery("/admin/accounts");
  const action = usePortalAction();
  const [form, setForm] = useState(defaults);
  const [assignments, setAssignments] = useState({});
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function create(event) {
    event.preventDefault();
    try {
      await action.mutateAsync({ path: "/admin/accounts", body: form });
      toast.success("Account created successfully.");
      setForm(defaults);
    } catch (error) { toast.error(error.message); }
  }
  async function toggle(account) {
    try {
      await action.mutateAsync({ path: `/admin/accounts/${account._id}`, method: "PATCH", body: { active: !account.active } });
      toast.success("Account status updated.");
    } catch (error) { toast.error(error.message); }
  }
  async function assign(student) {
    const selected = assignments[student._id] || {};
    try {
      await action.mutateAsync({ path: `/admin/accounts/assignments/${student._id}`, method: "PATCH", body: {
        assignedTeacher: selected.teacher ?? student.assignedTeacher ?? null,
        assignedClient: selected.client ?? student.assignedClient ?? null
      } });
      toast.success(`Assignments saved for ${student.name}.`);
    } catch (error) { toast.error(error.message); }
  }
  if (list.isLoading) return <Loading label="Loading accounts and assignments..." />;
  if (list.isError) return <ErrorView message={list.error.message} retry={list.refetch} />;
  const accounts = list.data.accounts || [];
  const teachers = accounts.filter(a => a.role === "teacher" && a.active);
  const clients = accounts.filter(a => a.role === "client" && a.active);
  const students = list.data.students || [];
  return <Page>
    <Heading eyebrow="ADMINISTRATION / ACCOUNTS" title="Teacher and client accounts" description="Create staff accounts and assign each student to a teacher and a host-company client." />
    <Panel title="Create account">
      <form className="portal-form" onSubmit={create}>
        <label className="field">Role<select value={form.role} onChange={e => update("role", e.target.value)}><option value="teacher">Teacher</option><option value="client">Client / Host supervisor</option></select></label>
        <label className="field">Full name<input required minLength={2} maxLength={100} value={form.name} onChange={e => update("name", e.target.value)} /></label>
        <label className="field">Email<input required type="email" value={form.email} onChange={e => update("email", e.target.value)} /></label>
        <label className="field">Temporary password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={e => update("password", e.target.value)} /></label>
        <label className="field">Company (optional)<input maxLength={120} value={form.company} onChange={e => update("company", e.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={action.isPending}>Create account</button>
      </form>
    </Panel>
    <Panel title="Existing accounts">
      {accounts.length ? <div className="portal-list">{accounts.map(a => <div className="portal-row" key={a._id}>
        <strong>{a.name} · {a.role}</strong><span>{a.email} · {a.active ? "Active" : "Inactive"}</span>
        <button className="btn btn-secondary" disabled={action.isPending} onClick={() => toggle(a)}>{a.active ? "Deactivate" : "Activate"}</button>
      </div>)}</div> : <Empty title="No teacher or client accounts" description="Create one using the form above." />}
    </Panel>
    <Panel title="Student assignments" caption="A student may be assigned to one teacher and one client at a time.">
      {students.length ? <div className="portal-list">{students.map(s => <div className="portal-row" key={s._id}>
        <strong>{s.name}</strong><span>{s.studentNo}</span>
        <div className="portal-form">
          <label className="field">Teacher<select value={assignments[s._id]?.teacher ?? s.assignedTeacher ?? ""} onChange={e => setAssignments(old => ({ ...old, [s._id]: { ...old[s._id], teacher: e.target.value } }))}>
            <option value="">Not assigned</option>{teachers.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select></label>
          <label className="field">Client<select value={assignments[s._id]?.client ?? s.assignedClient ?? ""} onChange={e => setAssignments(old => ({ ...old, [s._id]: { ...old[s._id], client: e.target.value } }))}>
            <option value="">Not assigned</option>{clients.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select></label>
          <button type="button" className="btn btn-primary" disabled={action.isPending} onClick={() => assign(s)}>Save assignment</button>
        </div>
      </div>)}</div> : <Empty title="No students yet" description="Create or register a student before assigning roles." />}
    </Panel>
  </Page>;
}