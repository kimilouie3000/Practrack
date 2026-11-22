import { useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight,
  Clock3, ClipboardCheck, GraduationCap, Hourglass,
  Mountain, Sparkles, XCircle
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { formatMinutes } from "../ui";

const ROLE_CONFIG = {
  student: { subtitle: "Your practicum journey, one verified hour at a time.", link: "/records", linkText: "My records", peopleTitle: "My placement", peopleTo: "/profile", peopleLinkText: "View profile" },
  admin: { subtitle: "Monitor training progress and keep every record on track.", link: "/admin/students", linkText: "Manage students", peopleTitle: "Recent students" },
  teacher: { subtitle: "Guide your assigned students and review their progress.", link: "/teacher/students", linkText: "My students", peopleTitle: "Assigned students" },
  client: { subtitle: "Follow your interns’ verified work and training milestones.", link: "/client/students", linkText: "Assigned interns", peopleTitle: "Your interns" }
};

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function numericMinutes(value) {
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function weekDates() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function matchesSchedule(schedule, date) {
  if (schedule.date) {
    const dateString = String(schedule.date).slice(0, 10);
    return dateString === dayKey(date);
  }
  return Number(schedule.dayOfWeek) === date.getDay();
}

function hoursText(minutes) {
  if (minutes <= 0) return "0h";
  return formatMinutes(minutes);
}

export function SkyGlassCard({ children, className = "", ...props }) {
  return <section className={`sky-glass ${className}`} {...props}>{children}</section>;
}

function SkyWeekStrip({ entries, schedules, role }) {
  const scrollRef = useRef(null);
  const dates = useMemo(weekDates, []);
  const [selected, setSelected] = useState(dayKey(new Date()));
  const today = dayKey(new Date());

  const weekly = dates.map(date => {
    const key = dayKey(date);
    const records = entries.filter(item => item.startAt && dayKey(new Date(item.startAt)) === key);
    const approved = records.filter(item => item.status === "approved")
      .reduce((sum, item) => sum + numericMinutes(item.minutes), 0);
    const pending = records.filter(item => item.status === "pending").length;
    const hasSchedule = schedules.some(schedule => matchesSchedule(schedule, date));
    return { date, key, approved, pending, hasSchedule };
  });

  function scroll(amount) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <section className="sky-week-section" aria-label="Weekly practicum activity">
      <div className="sky-section-heading">
        <div>
          <div className="sky-kicker">YOUR SEVEN-DAY VIEW</div>
          <h2>Weekly activity</h2>
          <p>{role === "student" ? "Scheduled sessions and recorded hours, Monday to Sunday" : "Available recorded hours this week, Monday to Sunday"}</p>
        </div>
        <div className="sky-steps">
          <button type="button" onClick={() => scroll(-420)} aria-label="Scroll days left"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => scroll(420)} aria-label="Scroll days right"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="sky-week-scroller" ref={scrollRef}>
        {weekly.map(item => {
          const active = selected === item.key;
          const label = item.date.toLocaleDateString("en-PH", { weekday: "short" });
          return (
            <button key={item.key} type="button" className={`sky-day ${active ? "is-active" : ""}`} onClick={() => setSelected(item.key)} aria-pressed={active} aria-label={`${label} ${item.date.getDate()}, ${hoursText(item.approved)} approved`}>
              <span className="sky-day-name">{label}</span>
              <span className="sky-day-icon"><CalendarDays size={19} strokeWidth={1.5}/></span>
              <strong>{item.date.getDate()}</strong>
              <small>{hoursText(item.approved)}</small>
              <span className="sky-day-status">{item.pending ? `${item.pending} pending` : item.hasSchedule ? "Scheduled" : item.approved ? "Approved" : item.key === today ? "Today" : "No records"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function trendData(entries, period) {
  const today = new Date();
  const count = period === "Today" ? 12 : period === "Week" ? 7 : 30;
  const result = [];
  for (let index = count - 1; index >= 0; index--) {
    const date = new Date(today);
    let label;
    let matched;
    if (period === "Today") {
      const hour = today.getHours() - index;
      date.setHours(hour, 0, 0, 0);
      const end = date.getTime() + 3600000;
      matched = entries.filter(entry => {
        if (entry.status !== "approved" || !entry.startAt) return false;
        const time = new Date(entry.startAt).getTime();
        return time >= date.getTime() && time < end;
      });
      label = date.toLocaleTimeString("en-PH", { hour: "numeric" });
    } else {
      date.setDate(today.getDate() - index);
      const key = dayKey(date);
      matched = entries.filter(entry => entry.status === "approved" && entry.startAt && dayKey(new Date(entry.startAt)) === key);
      label = period === "Week"
        ? date.toLocaleDateString("en-PH", { weekday: "short" })
        : date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    }
    result.push({ label, hours: Number((matched.reduce((sum, entry) => sum + numericMinutes(entry.minutes), 0) / 60).toFixed(2)) });
  }
  return result;
}

function SkyHoursChart({ entries, scopeNote }) {
  const [period, setPeriod] = useState("Week");
  const gradient = useId().replace(/:/g, "");
  const data = useMemo(() => trendData(entries, period), [entries, period]);
  const hasData = data.some(item => item.hours > 0);

  return (
    <SkyGlassCard className="sky-chart-card">
      <div className="sky-card-header">
        <div><div className="sky-kicker">PROGRESS AT A GLANCE</div><h2>Hours trend</h2><p>{scopeNote || "Approved hours over time"}</p></div>
        <div className="sky-period-switch" aria-label="Hours chart period">
          {["Today", "Week", "Month"].map(option => <button type="button" key={option} className={period === option ? "selected" : ""} aria-pressed={period === option} onClick={() => setPeriod(option)}>{option}</button>)}
        </div>
      </div>
      <div className="sky-chart-body" role="img" aria-label={`Approved hours chart for ${period.toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 2, left: -18 }}>
            <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8a94b" stopOpacity={0.34}/><stop offset="100%" stopColor="#e8a94b" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="#ffffff16" strokeDasharray="3 7" vertical={false}/>
            <XAxis dataKey="label" stroke="none" tick={{ fill: "#9ea9b8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24}/>
            <YAxis stroke="none" tick={{ fill: "#9ea9b8", fontSize: 10 }} tickLine={false} axisLine={false} width={32} tickFormatter={value => `${value}h`}/>
            <Tooltip contentStyle={{ border: "1px solid #665039", background: "#101d2a", borderRadius: 12, color: "#f4f2e9" }} formatter={value => [`${value} h`, "Approved"]}/>
            <Area dataKey="hours" type="monotone" stroke="#e8a94b" strokeWidth={2.6} fill={`url(#${gradient})`} activeDot={{ r: 5, stroke: "#fff", fill: "#e8a94b" }} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <div className="sky-chart-empty">No approved records in this period</div>}
    </SkyGlassCard>
  );
}

function SkyDetails({ approved, pending, rejected, rate, required, remaining }) {
  const metrics = [
    { Icon: Clock3, label: "Approved hours", value: formatMinutes(approved) },
    { Icon: ClipboardCheck, label: "Pending reviews", value: pending ?? "—" },
    { Icon: XCircle, label: "Rejected entries", value: rejected ?? "—" },
    { Icon: GraduationCap, label: "Attendance rate", value: rate == null ? "—" : `${rate}%` },
    { Icon: Hourglass, label: "Required hours", value: required == null ? "Per student" : formatMinutes(required) },
    { Icon: Mountain, label: "Remaining hours", value: remaining == null ? "Per student" : formatMinutes(remaining) }
  ];
  return (
    <SkyGlassCard className="sky-details-card">
      <div className="sky-kicker">YOUR PERFORMANCE</div>
      <h2>Practicum details</h2>
      <div className="sky-detail-list">
        {metrics.map(({ Icon, label, value }) => <div className="sky-detail" key={label}><Icon size={16} aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </SkyGlassCard>
  );
}

function SkyQuote() {
  return <SkyGlassCard className="sky-quote-card"><div className="sky-quote-picture" aria-hidden="true"/><div className="sky-quote-copy"><div className="sky-kicker">A LITTLE INSPIRATION</div><p>“Progress is built one verified hour at a time.”</p><small>— PracTrack</small></div></SkyGlassCard>;
}

function SkyPeople({ people, title, to, buttonText }) {
  return <SkyGlassCard className="sky-people-card">
    <div className="sky-card-header"><div><div className="sky-kicker">YOUR NETWORK</div><h2>{title}</h2></div><Link className="sky-all-link" to={to}>{buttonText} <ArrowRight size={15}/></Link></div>
    {people?.length ? <div className="sky-people-row">{people.slice(0, 7).map((person, index) => {
      const name = String(person.name || person.company || "Student");
      return <div className="sky-person" key={person._id || person.id || `${name}-${index}`} title={name}><div className="sky-person-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(piece => piece[0]?.toUpperCase()).join("")}</div><strong>{name}</strong><small>{person.company || person.studentNo || person.detail || "Practicum"}</small></div>;
    })}</div> : <p className="sky-empty-people">No students or placement details available yet.</p>}
  </SkyGlassCard>;
}

/** Purely presentational: all data is supplied by existing authenticated queries. */
export default function SkyOverview({ role = "student", name = "there", approvedMinutes = 0, pendingCount, rejectedCount, requiredMinutes, remainingMinutes, attendanceRate = null, entries = [], schedules = [], people = [], dataNote }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.student;
  const approved = numericMinutes(approvedMinutes);
  const safeName = String(name || "there").split(" ")[0];
  const hourDisplay = Math.round(approved / 60 * 10) / 10;
  return <div className="sky-overview">
    <section className="sky-hero" aria-label="Welcome and approved hours">
      {/* Decorative landscape shared by Student, Admin, Teacher, and Client dashboards. */}
      <img
        className="sky-hero-landscape"
        src="/images/practrack-mountains.jpg"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
      />
      <div className="sky-hero-copy"><div className="sky-kicker"><Sparkles size={13}/> YOUR PRACTICUM, YOUR PROGRESS</div><h1>Welcome back,<br/><em>{safeName}.</em></h1><p>{cfg.subtitle}</p><Link to={cfg.link} className="sky-hero-link">{cfg.linkText}<ArrowRight size={16}/></Link></div>
      <div className="sky-hero-metric"><span>TOTAL APPROVED TIME</span><strong>{hourDisplay}<small>hrs</small></strong><p>{role === "student" ? "Your verified practicum hours" : "Across the records visible to you"}</p></div>
    </section>
    <SkyWeekStrip role={role} entries={entries} schedules={schedules}/>
    <div className="sky-dashboard-grid">
      <SkyHoursChart entries={entries} scopeNote={dataNote}/>
      <SkyDetails approved={approved} pending={pendingCount} rejected={rejectedCount} rate={attendanceRate} required={requiredMinutes} remaining={remainingMinutes}/>
      <SkyQuote/>
    </div>
    <SkyPeople title={cfg.peopleTitle} people={people} to={cfg.peopleTo || cfg.link} buttonText={cfg.peopleLinkText || "See all"} />
  </div>;
}
