import { useState } from "react";
import useAuth from "../hooks/useAuth";
import SkyOverview from "../components/skyview/SkyOverview";
import { usePortalQuery } from "../hooks/usePortal";
import { Page, Heading, Panel, Loading, ErrorView, Empty, formatMinutes, formatDate } from "../components/ui";

export default function ClientPortalPage({ section = "overview" }) {
  const { user } = useAuth();
  const summary = usePortalQuery("/client/overview");
  const attendance = usePortalQuery("/client/attendance", section === "attendance" || section === "overview");
  const [studentId, setStudentId] = useState("");
  const detail = usePortalQuery(studentId ? `/client/students/${studentId}` : "", Boolean(studentId));
  if (summary.isLoading) return <Loading label="Loading host-company workspace..." />;
  if (summary.isError) return <ErrorView message={summary.error.message} retry={summary.refetch} />;
  const students = summary.data.students || [];
  const titles = { overview: "Client overview", students: "Assigned students", attendance: "Approved attendance" };
  return <Page>
    {section !== "overview" && <Heading eyebrow="HOST COMPANY / READ-ONLY" title={titles[section]} description="View the approved practicum progress of students assigned to your organization." />}
    {section === "overview" && <SkyOverview role="client" name={user?.name || "Supervisor"} approvedMinutes={summary.data.approvedMinutes || 0} pendingCount={null} rejectedCount={null} entries={attendance.data?.records || []} people={students} dataNote="Approved attendance visible to your organization only" />}
    {(section === "students" || section === "overview") && <Panel title="Student progress" caption="This portal cannot change records or approve hours.">
      {students.length ? <div className="portal-list">{students.map(student => <button type="button" className="portal-row" key={student._id} onClick={() => setStudentId(student._id)}>
        <strong>{student.name}</strong><span>{student.studentNo} · {student.company || "Host organization"}</span>
        <span>{formatMinutes(student.approvedMinutes)} approved · {formatMinutes(student.remainingMinutes)} remaining</span>
      </button>)}</div> : <Empty title="No assigned students" description="Your administrator must assign students to your account." />}
    </Panel>}
    {studentId && section !== "attendance" && <Panel title="Student attendance details">
      {detail.isLoading ? <Loading label="Loading student attendance..." /> : detail.isError ? <ErrorView message={detail.error.message} retry={detail.refetch} /> : <>
        <p><strong>{detail.data.student.name}</strong> · {detail.data.student.studentNo}</p>
        <p>Approved: {formatMinutes(detail.data.approvedMinutes)} · Remaining: {formatMinutes(detail.data.remainingMinutes)}</p>
        <div className="portal-list">{detail.data.attendance.map(entry => <div className="portal-row" key={entry._id}>
          {formatDate(entry.startAt)} · {formatMinutes(entry.minutes)} · {entry.description}
        </div>)}</div>
      </>}
    </Panel>}
    {section === "attendance" && <Panel title="Approved hours only" caption="Pending and rejected entries are not visible in the client portal.">
      {attendance.isLoading ? <Loading label="Loading approved attendance..." /> : attendance.isError ? <ErrorView message={attendance.error.message} retry={attendance.refetch} /> :
        (attendance.data.records || []).length ? <div className="portal-list">{attendance.data.records.map(entry => <div className="portal-row" key={entry._id}>
          <strong>{entry.user?.name}</strong><span>{formatDate(entry.startAt)} · {formatMinutes(entry.minutes)}</span>
          <p>{entry.description}</p></div>)}</div> : <Empty title="No approved attendance" description="Approved hours will appear after teacher or administrator verification." />}
    </Panel>}
  </Page>;
}