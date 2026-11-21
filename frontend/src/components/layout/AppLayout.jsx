
import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate
} from "react-router-dom";

import {
  LayoutGrid,
  CalendarDays,
  Clock3,
  ClipboardList,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Users,
  FileCheck2
} from "lucide-react";

import ClockLogo from "../ClockLogo";
import useAuth from "../../hooks/useAuth";
import { useProfile } from "../../hooks/usePracTrack";
import { useTheme } from "../../context/ThemeContext";

function SidebarNavigation({
  links,
  collapsed = false,
  mobile = false,
  onNavigate
}) {
  return (
    <nav
      className="nav-group"
      aria-label={
        mobile
          ? "Mobile workspace navigation"
          : "Workspace navigation"
      }
    >
      <div className="nav-caption">
        WORKSPACE
      </div>

      {links.map(({ path, label, Icon }) => (
        <NavLink
          key={path}
          to={path}
          title={collapsed ? label : undefined}
          aria-label={label}
          className={({ isActive }) =>
            `nav-link ${isActive ? "active" : ""}`
          }
          onClick={onNavigate}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter({ collapsed = false }) {
  return (
    <div className="sidebar-bottom">
      <div
        className="sidebar-note"
        title="Secure practicum workspace"
        aria-label="Secure practicum workspace"
      >
        <ShieldCheck size={18} aria-hidden="true" />

        {!collapsed && (
          <span className="sidebar-security-text">
            Secure practicum workspace
          </span>
        )}
      </div>
    </div>
  );
}

function SidebarBrand({
  collapsed = false,
  onNavigate,
  homePath = "/dashboard"
}) {
  return (
    <div className="logo practrack-brand">
      <ClockLogo />

      <NavLink
        className="brand-wordmark"
        to={homePath}
        onClick={onNavigate}
        aria-label="Go to PracTrack overview"
        title={
          collapsed ? "PracTrack" : undefined
        }
      >
        <strong>PracTrack</strong>
      </NavLink>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { data: profile } = useProfile();
  const { theme, toggleTheme } = useTheme();

  const location = useLocation();
  const navigate = useNavigate();

  const profileDropdownRef = useRef(null);

  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const isStaff = [
    "admin",
    "coordinator"
  ].includes(user?.role);

  const isAdmin = user?.role === "admin";

  const displayName =
    profile?.name ||
    user?.name ||
    "User";

  const homePath = isAdmin
    ? "/admin"
    : "/dashboard";

  const links = isAdmin
    ? [
        {
          path: "/admin",
          label: "Overview",
          Icon: LayoutGrid
        },
        {
          path: "/admin/students",
          label: "Students",
          Icon: Users
        },
        {
          path: "/admin/records",
          label: "Hours & Approvals",
          Icon: FileCheck2
        },
        {
          path: "/admin/schedule",
          label: "Schedules",
          Icon: CalendarDays
        },
        {
          path: "/profile",
          label: "My Profile",
          Icon: UserRound
        }
      ]
    : [
        {
          path: "/dashboard",
          label: "Overview",
          Icon: LayoutGrid
        },
        {
          path: "/schedule",
          label: "Schedule",
          Icon: CalendarDays
        },
        ...(!isStaff
          ? [
              {
                path: "/attendance",
                label: "Attendance",
                Icon: Clock3
              }
            ]
          : []),
        {
          path: "/records",
          label: isStaff
            ? "Approvals & records"
            : "My Records",
          Icon: ClipboardList
        },
        {
          path: "/profile",
          label: "My Profile",
          Icon: UserRound
        }
      ];

  useEffect(() => {
    setDrawer(false);
    setProfileMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawer) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        setDrawer(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [drawer]);

  useEffect(() => {
    if (!profileMenu) return;

    function handleOutsideClick(event) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(
          event.target
        )
      ) {
        setProfileMenu(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileMenu(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [profileMenu]);

  function signOut() {
    setProfileMenu(false);
    setDrawer(false);

    logout();

    navigate("/login", {
      replace: true
    });
  }

  return (
    <div
      className={`shell ${
        collapsed ? "shell-collapsed" : ""
      }`}
    >
      {/* Desktop sidebar */}
      <aside
        className="sidebar desktop-only"
        aria-label="Desktop sidebar"
      >
        <div className="sidebar-brand">
          <SidebarBrand
            collapsed={collapsed}
            homePath={homePath}
          />

          <button
            type="button"
            className="icon-btn collapse-btn"
            onClick={() =>
              setCollapsed(current => !current)
            }
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            aria-expanded={!collapsed}
            title={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        <div className="sidebar-nav-scroll">
          <SidebarNavigation
            links={links}
            collapsed={collapsed}
          />
        </div>

        <SidebarFooter collapsed={collapsed} />
      </aside>

      {/* Mobile backdrop */}
      {drawer && (
        <div
          className="mobile-shade"
          onClick={() => setDrawer(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`mobile-drawer ${
          drawer ? "open" : ""
        }`}
        aria-label="Mobile sidebar"
        aria-hidden={!drawer}
      >
        <div className="sidebar-brand">
          <SidebarBrand
            homePath={homePath}
            onNavigate={() => setDrawer(false)}
          />

          <button
            type="button"
            className="icon-btn"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-nav-scroll">
          <SidebarNavigation
            links={links}
            mobile
            onNavigate={() => setDrawer(false)}
          />
        </div>

        <SidebarFooter />
      </aside>

      {/* Main application */}
      <div className="shell-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn mobile-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span className="topbar-eyebrow">
                {isAdmin
                  ? "ADMIN WORKSPACE"
                  : "PRACTICUM MANAGEMENT"}
              </span>

              <strong>
                Practicum Hours & Verification System
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <span
              className="connection-dot"
              title="Secure workspace"
            />

            {/* Theme toggle */}
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>

            {/* Account dropdown */}
            <div
              className="profile-drop"
              ref={profileDropdownRef}
            >
              <button
                type="button"
                className="profile-trigger"
                onClick={() =>
                  setProfileMenu(current => !current)
                }
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={profileMenu}
              >
                <span className="avatar">
                  {displayName.charAt(0).toUpperCase()}
                </span>

                <span className="topbar-identity">
                  <strong>{displayName}</strong>

                  <small>
                    {isAdmin
                      ? "Admin"
                      : user?.role === "coordinator"
                        ? "Coordinator"
                        : "Student"}
                  </small>
                </span>

                <ChevronDown
                  size={15}
                  style={{
                    transform: profileMenu
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition:
                      "transform 0.2s ease"
                  }}
                />
              </button>

              {profileMenu && (
                <div
                  className="profile-popover"
                  role="menu"
                  aria-label="Account actions"
                >
                  <NavLink
                    to="/profile"
                    role="menuitem"
                    onClick={() =>
                      setProfileMenu(false)
                    }
                  >
                    <UserRound size={16} />
                    My profile
                  </NavLink>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          © PracTrack · Practicum Hours and
          Verification System
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="bottom-nav"
        aria-label="Mobile navigation"
      >
        {links.slice(0, 4).map(
          ({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <Icon size={20} />

              <span>
                {label === "Approvals & records"
                  ? "Records"
                  : label}
              </span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}
