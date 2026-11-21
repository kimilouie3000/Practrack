
import {
  useEffect,
  useState
} from "react";

import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  UserRound,
  ShieldCheck,
  GraduationCap,
  ArrowRight
} from "lucide-react";

import useAuth from "../hooks/useAuth";

import {
  useApiAction,
  useProfile
} from "../hooks/usePracTrack";

import {
  Page,
  Heading,
  Panel,
  Loading,
  ErrorView
} from "../components/ui";

const initial = {
  name: "",
  phone: "",
  school: "",
  course: "",
  yearLevel: "",
  section: "",
  company: "",
  address: "",
  bio: ""
};

export default function ProfilePage({
  onboarding = false
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const query = useProfile();
  const action = useApiAction();

  const [form, setForm] = useState(initial);

  const student = user?.role === "student";

  useEffect(() => {
    if (!query.data) return;

    setForm(
      Object.fromEntries(
        Object.keys(initial).map(key => [
          key,
          query.data[key] || ""
        ])
      )
    );
  }, [query.data]);

  async function save(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return toast.error(
        "Your full name is required."
      );
    }

    if (
      student &&
      (
        !form.school.trim() ||
        !form.course.trim() ||
        !form.yearLevel.trim()
      )
    ) {
      return toast.error(
        "Complete your school, course, and year level."
      );
    }

    try {
      await action.mutateAsync({
        path: "/profile",
        method: "PATCH",
        body: form
      });

      toast.success(
        onboarding
          ? "Profile completed! Welcome to PracTrack."
          : "Profile updated successfully."
      );

      if (onboarding) {
        navigate("/dashboard", {
          replace: true
        });
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (query.isLoading) {
    return <Loading label="Loading profile..." />;
  }

  if (query.isError) {
    return (
      <ErrorView
        message={query.error.message}
        retry={query.refetch}
      />
    );
  }

  return (
    <Page>
      <Heading
        eyebrow={
          onboarding
            ? "LET'S GET STARTED"
            : "ACCOUNT & PERSONAL DETAILS"
        }
        title={
          onboarding
            ? "Set up your profile"
            : "My Profile"
        }
        description={
          onboarding
            ? "Tell us a little about your academic journey before continuing."
            : "Keep your training and student information up to date."
        }
      />

      {onboarding && (
        <div className="onboarding-banner">
          <GraduationCap size={23} />

          <div>
            <strong>
              One final step before your dashboard
            </strong>

            <p>
              Complete the required fields to unlock
              attendance, schedules and records.
            </p>
          </div>

          <span>STEP 1 / 1</span>
        </div>
      )}

      <div className="profile-layout">
        <Panel
          title="Personal information"
          caption="Your identity and contact details"
        >
          <form
            className="form-grid"
            onSubmit={save}
            id="profile-form"
          >
            <label className="field">
              Full name

              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={form.name}
                onChange={event =>
                  setForm({
                    ...form,
                    name: event.target.value
                  })
                }
              />
            </label>

            <label className="field">
              Email address

              <input
                disabled
                value={query.data?.email || ""}
              />
            </label>

            <label className="field">
              Student number

              <input
                disabled
                value={
                  query.data?.studentNo ||
                  (student ? "" : "Staff account")
                }
              />
            </label>

            <label className="field">
              Contact number

              <input
                maxLength={30}
                autoComplete="tel"
                placeholder="09xx xxx xxxx"
                value={form.phone}
                onChange={event =>
                  setForm({
                    ...form,
                    phone: event.target.value
                  })
                }
              />
            </label>

            {student && (
              <>
                <div className="form-section-title field-full">
                  <GraduationCap size={18} />
                  <strong>Academic information</strong>
                </div>

                <label className="field">
                  School / University

                  <input
                    required
                    maxLength={140}
                    placeholder="Your school name"
                    value={form.school}
                    onChange={event =>
                      setForm({
                        ...form,
                        school: event.target.value
                      })
                    }
                  />
                </label>

                <label className="field">
                  Course / Program

                  <input
                    required
                    maxLength={140}
                    placeholder="BS Information Technology"
                    value={form.course}
                    onChange={event =>
                      setForm({
                        ...form,
                        course: event.target.value
                      })
                    }
                  />
                </label>

                <label className="field">
                  Year level

                  <select
                    required
                    value={form.yearLevel}
                    onChange={event =>
                      setForm({
                        ...form,
                        yearLevel: event.target.value
                      })
                    }
                  >
                    <option value="">Select year</option>

                    {[
                      "1st Year",
                      "2nd Year",
                      "3rd Year",
                      "4th Year",
                      "5th Year",
                      "Other"
                    ].map(label => (
                      <option key={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Section

                  <input
                    maxLength={80}
                    placeholder="Optional"
                    value={form.section}
                    onChange={event =>
                      setForm({
                        ...form,
                        section: event.target.value
                      })
                    }
                  />
                </label>
              </>
            )}

            <div className="form-section-title field-full">
              <UserRound size={18} />
              <strong>Training details</strong>
            </div>

            <label className="field field-full">
              Company / Training organization

              <input
                maxLength={120}
                value={form.company}
                onChange={event =>
                  setForm({
                    ...form,
                    company: event.target.value
                  })
                }
                placeholder="Training organization name"
              />
            </label>

            <label className="field field-full">
              Address

              <input
                maxLength={200}
                value={form.address}
                onChange={event =>
                  setForm({
                    ...form,
                    address: event.target.value
                  })
                }
                placeholder="Optional"
              />
            </label>

            <label className="field field-full">
              About me

              <textarea
                rows={3}
                maxLength={400}
                value={form.bio}
                onChange={event =>
                  setForm({
                    ...form,
                    bio: event.target.value
                  })
                }
                placeholder="A short introduction (optional)"
              />
            </label>

            <div className="field-full modal-actions">
              <button
                className="btn btn-primary"
                disabled={action.isPending}
              >
                {action.isPending
                  ? "Saving..."
                  : onboarding
                    ? "Complete setup"
                    : "Save changes"}

                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </Panel>

        <div className="profile-aside">
          <div className="panel profile-preview">
            <div className="profile-large-avatar">
              {form.name?.charAt(0)?.toUpperCase() ||
                "U"}
            </div>

            <h3>{form.name || "Your name"}</h3>

            <p className="subtle">
              {query.data?.email}
            </p>

            <span className="pill pill-approved">
              {student ? "Student" : "Staff"}
            </span>

            <div className="preview-divider" />

            <div className="preview-line">
              <span>Profile</span>

              <strong>
                {query.data?.completed
                  ? "Complete"
                  : "Needs setup"}
              </strong>
            </div>

            <div className="preview-line">
              <span>Program</span>
              <strong>{form.course || "—"}</strong>
            </div>

            <div className="preview-line">
              <span>School</span>
              <strong>{form.school || "—"}</strong>
            </div>
          </div>

          <div className="profile-hint">
            <ShieldCheck size={19} />

            <p>
              Your profile is visible only to authorized
              users of the practicum system.
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
