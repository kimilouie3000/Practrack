
import { Link } from "react-router-dom";

import {
  Users,
  ClipboardCheck,
  Clock3,
  ArrowRight,
  CalendarDays,
  ShieldCheck
} from "lucide-react";

import { useAdminOverview } from "../hooks/useAdmin";

import {
  Page,
  Heading,
  Metric,
  Panel,
  Pill,
  Loading,
  ErrorView,
  Empty,
  formatMinutes,
  formatDate
} from "../components/ui";

export default function AdminOverviewPage() {
  const report = useAdminOverview();

  if (report.isLoading) {
    return (
      <Loading label="Loading administrator insights..." />
    );
  }

  if (report.isError) {
    return (
      <ErrorView
        message={report.error.message}
        retry={report.refetch}
      />
    );
  }

  const data = report.data;

  return (
    <Page>
      <Heading
        eyebrow="ADMINISTRATION / OVERVIEW"
        title="Admin workspace"
        description="Manage students, verify practicum hours, and monitor system activity."
        actions={
          <Link
            className="btn btn-primary"
            to="/admin/students"
          >
            <Users size={16} />
            Manage students
          </Link>
        }
      />

      <div className="metric-grid">
        <Metric
          icon={Users}
          label="Enrolled students"
          value={data.totalStudents}
          helper="Active student accounts"
          emphasis
        />

        <Metric
          icon={ClipboardCheck}
          label="Pending reviews"
          value={data.pendingEntries}
          helper="Entries awaiting approval"
        />

        <Metric
          icon={Clock3}
          label="Approved hours"
          value={formatMinutes(data.approvedMinutes)}
          helper="Total hours across students"
        />
      </div>

      <div className="admin-quick-links">
        <Link to="/admin/students">
          <Users size={19} />
          <span>
            <strong>Student management</strong>
            <small>
              Create, edit, inspect, or remove accounts
            </small>
          </span>
          <ArrowRight size={17} />
        </Link>

        <Link to="/admin/records">
          <ClipboardCheck size={19} />
          <span>
            <strong>Hours verification</strong>
            <small>
              Review submissions and correct entries
            </small>
          </span>
          <ArrowRight size={17} />
        </Link>

        <Link to="/admin/schedule">
          <CalendarDays size={19} />
          <span>
            <strong>Schedule management</strong>
            <small>
              Assign and update practicum sessions
            </small>
          </span>
          <ArrowRight size={17} />
        </Link>
      </div>

      <div className="admin-two-columns">
        <Panel
          title="Recent time entries"
          caption="Latest attendance activity"
          action={
            <Link
              className="text-link"
              to="/admin/records"
            >
              View all
              <ArrowRight size={15} />
            </Link>
          }
        >
          {data.recentEntries?.length ? (
            <div className="activity-list">
              {data.recentEntries.map(entry => (
                <div
                  className="activity-row"
                  key={entry._id}
                >
                  <span className="activity-dot">
                    <Clock3 size={16} />
                  </span>

                  <div className="activity-name">
                    <strong>
                      {entry.user?.name ||
                        "Former student"}
                    </strong>

                    <span>
                      {entry.description}
                      {" · "}
                      {formatMinutes(entry.minutes)}
                      {" · "}
                      {formatDate(entry.updatedAt)}
                    </span>
                  </div>

                  <Pill status={entry.status} />
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No activity yet" />
          )}
        </Panel>

        <Panel
          title="Administrator activity"
          caption="Recent management actions"
        >
          {data.recentActions?.length ? (
            <div className="activity-list">
              {data.recentActions.map(item => (
                <div
                  className="activity-row"
                  key={item._id}
                >
                  <span className="activity-dot">
                    <ShieldCheck size={16} />
                  </span>

                  <div className="activity-name">
                    <strong>
                      {item.action}: {item.subject}
                    </strong>

                    <span>
                      {item.actor?.name ||
                        "Administrator"}
                      {" · "}
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No admin changes yet" />
          )}
        </Panel>
      </div>
    </Page>
  );
}
