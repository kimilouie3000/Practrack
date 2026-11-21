
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState
} from "react";

import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";

import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";

import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  LogIn
} from "lucide-react";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import useAuth from "./hooks/useAuth";
import { useProfile } from "./hooks/usePracTrack";

import ProtectedRoute from "./routes/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";

import {
  Loading,
  ErrorView
} from "./components/ui";

// Student pages
const OverviewPage = lazy(
  () => import("./pages/OverviewPage")
);

const SchedulePage = lazy(
  () => import("./pages/SchedulePage")
);

const AttendancePage = lazy(
  () => import("./pages/AttendancePage")
);

const RecordsPage = lazy(
  () => import("./pages/RecordsPage")
);

const ProfilePage = lazy(
  () => import("./pages/ProfilePage")
);

// Admin pages
const AdminOverviewPage = lazy(
  () => import("./pages/AdminOverviewPage")
);

const AdminStudentsPage = lazy(
  () => import("./pages/AdminStudentsPage")
);

const AdminRecordsPage = lazy(
  () => import("./pages/AdminRecordsPage")
);

const fadeAnimation = {
  hidden: {
    opacity: 0,
    y: 18
  },
  visible: {
    opacity: 1,
    y: 0
  }
};

const animationTransition = {
  duration: 0.4,
  ease: "easeOut"
};

// LOGIN / REGISTER

function AuthPage() {
  const {
    authenticate,
    isAuthenticated,
    initializing,
    user
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const submitted = useRef(false);

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    studentNo: "",
    email: "",
    password: ""
  });

  const isRegister = mode === "register";

  useEffect(() => {
    if (
      !initializing &&
      isAuthenticated &&
      !submitted.current
    ) {
      navigate(
        user?.role === "admin"
          ? "/admin"
          : "/dashboard",
        { replace: true }
      );
    }
  }, [
    initializing,
    isAuthenticated,
    navigate,
    user?.role
  ]);

  function updateForm(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  }

  function switchMode() {
    setMode(current =>
      current === "login"
        ? "register"
        : "login"
    );

    setShowPassword(false);

    setForm(current => ({
      ...current,
      password: ""
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    const email = form.email.trim().toLowerCase();

    if (!email || !form.password) {
      toast.error(
        "Please complete the required fields."
      );
      return;
    }

    if (isRegister) {
      if (form.name.trim().length < 2) {
        toast.error(
          "Enter your complete name."
        );
        return;
      }

      if (
        !/^\d{4}-\d{5}$/.test(
          form.studentNo.trim()
        )
      ) {
        toast.error(
          "Student number must follow YYYY-NNNNN."
        );
        return;
      }

      if (form.password.length < 8) {
        toast.error(
          "Password must contain at least 8 characters."
        );
        return;
      }
    }

    setSubmitting(true);
    submitted.current = true;

    try {
      const signedInUser = await authenticate(mode, {
        ...form,
        name: form.name.trim(),
        studentNo: form.studentNo.trim(),
        email
      });

      if (isRegister) {
        toast.success(
          "Account created! Complete your student profile."
        );

        navigate("/setup", {
          replace: true
        });
      } else {
        toast.success(
          "Welcome back to PracTrack!"
        );

        const destination =
          location.state?.from?.pathname ||
          "/dashboard";

        navigate(
          signedInUser?.role === "admin"
            ? "/admin"
            : destination === "/login" ||
              destination.startsWith("/admin")
                ? "/dashboard"
                : destination,
          { replace: true }
        );
      }
    } catch (error) {
      submitted.current = false;

      toast.error(
        error.message ||
        "Authentication failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-shell">
        <motion.section
          className="auth-story"
          variants={fadeAnimation}
          initial="hidden"
          animate="visible"
          transition={animationTransition}
        >
          <div className="logo">
            <span className="logo-mark">
              P
            </span>
            <strong>PracTrack</strong>
          </div>

          <span className="eyebrow">
            PRACTICUM MANAGEMENT PLATFORM
          </span>

          <h1>
            Every hour.
            <br />
            <span>
              One clear path
            </span>{" "}
            forward.
          </h1>

          <p>
            Organize your training schedule, record daily
            attendance, submit practicum hours, and track
            your verified progress through one connected
            workspace.
          </p>

          <div className="auth-points">
            <span>
              01 &nbsp; Smart attendance tracking
            </span>
            <span>
              02 &nbsp; Organized weekly schedules
            </span>
            <span>
              03 &nbsp; Verified practicum records
            </span>
          </div>
        </motion.section>

        <motion.form
          className="auth-form panel"
          onSubmit={handleSubmit}
          variants={fadeAnimation}
          initial="hidden"
          animate="visible"
          transition={{
            ...animationTransition,
            delay: 0.1
          }}
        >
          <span className="eyebrow">
            {isRegister
              ? "STUDENT REGISTRATION"
              : "ACCOUNT ACCESS"}
          </span>

          <h2>
            {isRegister
              ? "Create your account"
              : "Welcome back"}
          </h2>

          <p className="subtle">
            {isRegister
              ? "Register to start tracking your practicum journey."
              : "Sign in to continue to your workspace."}
          </p>

          {isRegister && (
            <>
              <label className="field">
                Full name

                <input
                  type="text"
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={event =>
                    updateForm(
                      "name",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="field">
                Student number

                <input
                  type="text"
                  name="studentNo"
                  required
                  pattern="[0-9]{4}-[0-9]{5}"
                  placeholder="2023-00001"
                  value={form.studentNo}
                  onChange={event =>
                    updateForm(
                      "studentNo",
                      event.target.value
                    )
                  }
                />
              </label>
            </>
          )}

          <label className="field">
            Email address

            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="student@example.com"
              value={form.email}
              onChange={event =>
                updateForm(
                  "email",
                  event.target.value
                )
              }
            />
          </label>

          <label className="field">
            Password

            <div className="password-input">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                required
                minLength={
                  isRegister ? 8 : undefined
                }
                autoComplete={
                  isRegister
                    ? "new-password"
                    : "current-password"
                }
                placeholder="Enter your password"
                value={form.password}
                onChange={event =>
                  updateForm(
                    "password",
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                className="password-eye"
                onClick={() =>
                  setShowPassword(
                    current => !current
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? (
              "Please wait..."
            ) : (
              <>
                {isRegister ? (
                  <GraduationCap size={18} />
                ) : (
                  <LogIn size={18} />
                )}

                {isRegister
                  ? "Create account"
                  : "Sign in"}

                <ArrowRight size={17} />
              </>
            )}
          </button>

          <p className="auth-switch">
            {isRegister
              ? "Already have an account?"
              : "New to PracTrack?"}

            {" "}

            <button
              type="button"
              onClick={switchMode}
              disabled={submitting}
            >
              {isRegister
                ? "Sign in"
                : "Create an account"}
            </button>
          </p>

          <div className="secure-note">
            <LockKeyhole size={16} />
            <span>
              Secure student authentication
            </span>
          </div>
        </motion.form>
      </div>
    </main>
  );
}

// LOADING

function PageLoader() {
  return (
    <div
      className="state-message"
      role="status"
      aria-live="polite"
    >
      <Loading label="Preparing your workspace..." />
    </div>
  );
}

// SCROLL RESET

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });
  }, [pathname]);

  return null;
}

// STUDENT ONBOARDING CHECK

function OnboardingGate() {
  const { user } = useAuth();

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch
  } = useProfile();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <ErrorView
        message={
          error?.message ||
          "Unable to load your student profile."
        }
        retry={refetch}
      />
    );
  }

  if (
    user?.role === "student" &&
    !profile?.completed
  ) {
    return (
      <Navigate
        to="/setup"
        replace
      />
    );
  }

  return <Outlet />;
}

// FIRST-TIME STUDENT SETUP

function SetupPage() {
  const { user } = useAuth();

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch
  } = useProfile();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <ErrorView
        message={error.message}
        retry={refetch}
      />
    );
  }

  if (user?.role !== "student") {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  if (profile?.completed) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return <ProfilePage onboarding />;
}

// LAZY PAGE WRAPPER

function LazyPage({ children }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

// ROUTING

function AppRoutes() {
  return (
    <>
      <ScrollToTop />

      <Toaster
        position="top-right"
        richColors
        closeButton
        expand
        duration={3500}
        toastOptions={{
          style: {
            borderRadius: "12px"
          }
        }}
      />

      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/login"
          element={<AuthPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Student onboarding */}
            <Route
              path="/setup"
              element={
                <LazyPage>
                  <SetupPage />
                </LazyPage>
              }
            />

            {/* Admin-only routes */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={["admin"]}
                />
              }
            >
              <Route
                path="/admin"
                element={
                  <LazyPage>
                    <AdminOverviewPage />
                  </LazyPage>
                }
              />

              <Route
                path="/admin/students"
                element={
                  <LazyPage>
                    <AdminStudentsPage />
                  </LazyPage>
                }
              />

              <Route
                path="/admin/records"
                element={
                  <LazyPage>
                    <AdminRecordsPage />
                  </LazyPage>
                }
              />

              <Route
                path="/admin/schedule"
                element={
                  <LazyPage>
                    <SchedulePage />
                  </LazyPage>
                }
              />
            </Route>

            {/* Student and coordinator routes */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "student",
                    "coordinator"
                  ]}
                />
              }
            >
              <Route element={<OnboardingGate />}>
                <Route
                  path="/dashboard"
                  element={
                    <LazyPage>
                      <OverviewPage />
                    </LazyPage>
                  }
                />

                <Route
                  path="/schedule"
                  element={
                    <LazyPage>
                      <SchedulePage />
                    </LazyPage>
                  }
                />

                <Route
                  path="/attendance"
                  element={
                    <LazyPage>
                      <AttendancePage />
                    </LazyPage>
                  }
                />

                <Route
                  path="/records"
                  element={
                    <LazyPage>
                      <RecordsPage />
                    </LazyPage>
                  }
                />
              </Route>
            </Route>

            {/* Profile available for every role */}
            <Route
              path="/profile"
              element={
                <LazyPage>
                  <ProfilePage />
                </LazyPage>
              }
            />
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />
      </Routes>
    </>
  );
}

// ROOT APPLICATION

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
