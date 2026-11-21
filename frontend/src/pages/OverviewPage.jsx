
import { Link } from "react-router-dom";
import {
  Clock3,
  Hourglass,
  ClipboardCheck,
  ArrowUpRight,
  CalendarDays,
  ArrowRight,
  Users,
  Activity
} from "lucide-react";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis
} from "recharts";

import useAuth from "../hooks/useAuth";

import {
  useProfile,
  useRecords,
  useSchedules,
  useStudents
} from "../hooks/usePracTrack";

import {
  Page,
  Heading,
  Panel,
  Metric,
  Pill,
  Loading,
  ErrorView,
  Empty,
  formatMinutes,
  formatDate
} from "../components/ui";

export default function OverviewPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const records = useRecords();
  const schedules = useSchedules();
  const students = useStudents();

  const staff = ["admin", "coordinator"].includes(
    user?.role
  );

  if (records.isLoading) {
    return <Loading label="Loading overview..." />;
  }

  if (records.isError) {
    return (
      <ErrorView
        message={records.error.message}
        retry={records.refetch}
      />
    );
  }

  const entries = records.data || [];

  const approved = entries.filter(
    item => item.status === "approved"
  );

  const pending = entries.filter(
    item => item.status === "pending"
  );

  const minutes = approved.reduce(
    (sum, item) =>
      sum + (Number(item.minutes) || 0),
    0
  );

  const remaining = Math.max(0, 14400 - minutes);

  const percentage = Math.min(
    100,
    Math.round(minutes / 14400 * 100)
  );

  const name =
    profile?.name || user?.name || "there";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const week = Array.from(
    { length: 7 },
    (_, i) => {
      const date = new Date(startOfToday);
      date.setDate(date.getDate() - 6 + i);

      const label = date.toLocaleDateString(
        "en-PH",
        { weekday: "short" }
      );

      const value = approved
        .filter(
          item =>
            item.startAt &&
            new Date(item.startAt).toDateString() ===
              date.toDateString()
        )
        .reduce(
          (sum, item) =>
            sum + (item.minutes || 0),
          0
        );

      return {
        label,
        hours: Math.round(value / 60 * 10) / 10
      };
    }
  );

  const recent = [...entries].slice(0, 5);

  return (
    <Page>
      <Heading
        eyebrow={
          staff
            ? "COORDINATOR WORKSPACE"
            : "STUDENT WORKSPACE"
        }
        title={`Hello, ${name.split(" ")[0]}.`}
        description={
          staff
            ? "Review activity across practicum participants."
            : "Your progress, attendance, and schedule at a glance."
        }
        actions={
          <Link
            className="btn btn-secondary"
            to="/schedule"
          >
            <CalendarDays size={17} />
            View schedule
          </Link>
        }
      />

      <div className="metric-grid">
        {staff ? (
          <>
            <Metric
              icon={Users}
              label="Active students"
              value={students.data?.length ?? "—"}
              helper="Registered participants"
              emphasis
            />

            <Metric
              icon={ClipboardCheck}
              label="Pending entries"
              value={pending.length}
              helper="Waiting for your review"
            />

            <Metric
              icon={Activity}
              label="Approved time"
              value={formatMinutes(minutes)}
              helper="Across visible records"
            />
          </>
        ) : (
          <>
            <Metric
              icon={Clock3}
              label="Approved hours"
              value={formatMinutes(minutes)}
              helper="Confirmed training hours"
              emphasis
            />

            <Metric
              icon={Hourglass}
              label="Remaining hours"
              value={formatMinutes(remaining)}
              helper="Of the 240-hour requirement"
            />

            <Metric
              icon={ClipboardCheck}
              label="Pending entries"
              value={pending.length}
              helper="Awaiting review"
            />
          </>
        )}
      </div>

      <div className="overview-grid">
        <Panel
          title={
            staff
              ? "Approved hours this week"
              : "Your weekly activity"
          }
          caption="Approved practicum hours from the last 7 days"
          action={
            <span className="chart-tag">
              7 DAYS
            </span>
          }
        >
          <div className="chart-box">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={week}
                margin={{
                  top: 18,
                  right: 6,
                  left: 6,
                  bottom: 2
                }}
              >
                <defs>
                  <linearGradient
                    id="hoursFill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#6686ff"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="#6686ff"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="4 6"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "#95a4bd",
                    fontSize: 11
                  }}
                />

                <Tooltip
                  contentStyle={{
                    background: "#17233a",
                    color: "white",
                    border: "1px solid #33425f",
                    borderRadius: 12
                  }}
                  formatter={value => [
                    `${value} h`,
                    "Approved"
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#6b8bff"
                  strokeWidth={3}
                  fill="url(#hoursFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title={
            staff
              ? "Review queue"
              : "Completion progress"
          }
          caption={
            staff
              ? "Stay on top of incoming submissions"
              : "Toward your 240-hour requirement"
          }
        >
          {staff ? (
            <div className="progress-side">
              <strong className="progress-large">
                {pending.length}
              </strong>

              <p className="subtle">
                Entries need a decision
              </p>

              <Link
                to="/records"
                className="btn btn-primary"
              >
                Open approval queue
                <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <div className="progress-side">
              <div className="progress-number">
                {percentage}
                <span>%</span>
              </div>

              <div className="progress-track">
                <div
                  style={{
                    width: `${percentage}%`
                  }}
                />
              </div>

              <div className="progress-caption">
                <span>
                  {formatMinutes(minutes)} completed
                </span>

                <span>240h goal</span>
              </div>

              <Link
                to="/attendance"
                className="btn btn-primary"
              >
                Record hours
                <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent activity"
        caption="Latest attendance and submitted records"
        action={
          <Link
            className="text-link"
            to="/records"
          >
            View all
            <ArrowUpRight size={15} />
          </Link>
        }
      >
        {recent.length === 0 ? (
          <Empty
            title="No activity yet"
            description="Your records will appear here after your first submission."
          />
        ) : (
          <div className="activity-list">
            {recent.map(item => (
              <div
                className="activity-row"
                key={item._id}
              >
                <span className="activity-dot">
                  <Clock3 size={16} />
                </span>

                <div className="activity-name">
                  <strong>
                    {item.description ||
                      "Practicum attendance"}
                  </strong>

                  <span>
                    {staff
                      ? `${item.user?.name || "Student"} · `
                      : ""}
                    {formatDate(item.startAt)}
                    {" · "}
                    {formatMinutes(item.minutes)}
                  </span>
                </div>

                <Pill status={item.status} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="tip-strip">
        <CalendarDays size={19} />

        <span>
          {schedules.data?.length
            ? `You have ${schedules.data.length} scheduled session(s).`
            : "No weekly schedule has been assigned yet."}
        </span>

        <Link to="/schedule">
          Open schedule
          <ArrowRight size={15} />
        </Link>
      </div>
    </Page>
  );
}
