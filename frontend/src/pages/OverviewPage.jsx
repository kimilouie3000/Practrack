import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { usePracTrackSettings } from "../hooks/useSettings";
import { useProfile, useRecords, useSchedules } from "../hooks/usePracTrack";
import SkyOverview from "../components/skyview/SkyOverview";
import { Page, Panel, Loading, ErrorView, Empty, Pill, formatMinutes, formatDate } from "../components/ui";

export default function OverviewPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const settings = usePracTrackSettings();
  const records = useRecords();
  const schedules = useSchedules();

  if (records.isLoading) return <Loading label="Loading your practicum overview..." />;
  if (records.isError) return <ErrorView message={records.error.message} retry={records.refetch} />;

  const entries = records.data || [];
  const approved = entries.filter(entry => entry.status === "approved");
  const approvedMinutes = approved.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const required = profile?.requiredMinutes ?? settings.data?.requiredMinutes ?? null;
  const remaining = required == null ? null : Math.max(0, required - approvedMinutes);
  const people = profile?.company ? [{ id: "placement", name: profile.company, detail: "Your host organization" }] : [];
  const recent = entries.slice(0, 5);

  return <Page>
    <SkyOverview
      role="student"
      name={profile?.name || user?.name || "Student"}
      approvedMinutes={approvedMinutes}
      pendingCount={entries.filter(entry => entry.status === "pending").length}
      rejectedCount={entries.filter(entry => entry.status === "rejected").length}
      requiredMinutes={required}
      remainingMinutes={remaining}
      entries={entries}
      schedules={schedules.data || []}
      people={people}
    />
    <Panel title="Recent activity" caption="Latest entries submitted for verification" action={<Link className="text-link" to="/records">All records <ArrowRight size={16}/></Link>}>
      {recent.length ? <div className="activity-list">{recent.map(entry => <div className="activity-row" key={entry._id}><span className="activity-dot"><Clock3 size={16}/></span><div className="activity-name"><strong>{entry.description || "Practicum attendance"}</strong><span>{formatDate(entry.startAt)} · {formatMinutes(entry.minutes)}</span></div><Pill status={entry.status}/></div>)}</div> : <Empty title="No activity yet" description="Your practicum entries will appear here after your first submission."/>}
    </Panel>
  </Page>;
}