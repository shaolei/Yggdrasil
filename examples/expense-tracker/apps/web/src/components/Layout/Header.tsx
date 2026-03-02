import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/expenses", label: "Expenses" },
  { to: "/categories", label: "Categories" },
  { to: "/budgets", label: "Budgets" },
  { to: "/reports", label: "Reports" },
];

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate("/");
    setOpen(false);
  };

  return (
    <header className="header">
      <Link to="/dashboard" className="header__logo">
        Expense Tracker
      </Link>
      <nav className="header__nav">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={location.pathname.startsWith(item.to) ? "active" : ""}
          >
            {item.label}
          </Link>
        ))}
        <div className="header__dropdown" ref={ref}>
          <button
            type="button"
            className="header__dropdown-btn"
            onClick={() => setOpen(!open)}
          >
            {user?.email ?? "..."} ▼
          </button>
          {open && (
            <div className="header__dropdown-menu">
              <Link to="/settings" onClick={() => setOpen(false)}>
                Settings
              </Link>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
