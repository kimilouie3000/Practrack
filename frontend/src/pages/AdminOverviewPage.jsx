import { Link } from "react-router-dom";
import { ArrowRight, Users, ClipboardCheck, CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import { useAdminOverview } from "../hooks/useAdmin";
import useAuth from "../hooks/useAuth";
import SkyOverview from "../components/skyview/SkyOverview";
import { Page, Panel, Pill, Loading, ErrorView, Empty, formatMinutes, formatDate } from "../components/ui";

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const report = useAdminOverview();
  if (report.isLoading) return <Loading label="Loading administrator insights..." />;
  if (report.isError) return <ErrorView message={report.error.message} retry={report.refetch} />;

  const data = report.data || {};
  const entries = data.recentEntries || [];
  const seen = new Set();
  const people = entries.filter(entry => {
    const person = entry.user;
    if (!person?._id || seen.has(person._id)) return false;
    seen.add(person._id);
    return true;
  }).map(entry => entry.user);

  return <Page>
    <SkyOverview
      role="admin"
      name={user?.name || "Administrator"}
      approvedMinutes={data.approvedMinutes || 0}
      pendingCount={data.pendingEntries ?? 0}
      rejectedCount={null}
      entries={entries}
      people={people}
      dataNote="Recent activity only; total approved hours above includes all students"
    />
    <div className="admin-quick-links sky-quick-actions">
      <Link to="/admin/students"><Users size={19}/><span><strong>Student management</strong><small>{data.totalStudents ?? 0} active students · manage assignments</small></span><ArrowRight size={17}/></Link>
      <Link to="/admin/records"><ClipboardCheck size={19}/><span><strong>Hours verification</strong><small>Review pending attendance and make adjustments</small></span><ArrowRight size={17}/></Link>
      <Link to="/admin/schedule"><CalendarDays size={19}/><span><strong>Schedule management</strong><small>Manage assigned practicum sessions</small></span><ArrowRight size={17}/></Link>
    </div>
    <div className="admin-two-columns">
      <Panel title="Recent time entries" caption="Latest attendance activity" action={<Link className="text-link" to="/admin/records">View all <ArrowRight size={15}/></Link>}>
        {entries.length ? <div className="activity-list">{entries.map(entry => <div className="activity-row" key={entry._id}><span className="activity-dot"><Clock3 size={16}/></span><div className="activity-name"><strong>{entry.user?.name || "Former student"}</strong><span>{entry.description} · {formatMinutes(entry.minutes)} · {formatDate(entry.updatedAt)}</span></div><Pill status={entry.status}/></div>)}</div> : <Empty title="No activity yet"/>}
      </Panel>
      <Panel title="Administrator activity" caption="Recent management actions">
        {data.recentActions?.length ? <div className="activity-list">{data.recentActions.map(item => <div className="activity-row" key={item._id}><span className="activity-dot"><ShieldCheck size={16}/></span><div className="activity-name"><strong>{item.action}: {item.subject}</strong><span>{item.actor?.name || "Administrator"} · {formatDate(item.createdAt)}</span></div></div>)}</div> : <Empty title="No admin changes yet"/>}
      </Panel>
    </div>
  </Page>;
}