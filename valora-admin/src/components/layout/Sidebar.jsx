import React from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/valora-logo.svg";
import { IconGrid, IconLogout, IconShield, IconUsers } from "./icons";

function IconReport(props) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function NavItem({ to, icon, label }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link to={to} data-active={active ? "true" : "false"}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logo} alt="Valora" />
        <div className="title">
          <strong>Valora Admin</strong>
          <span>Defend before you send</span>
        </div>
      </div>

      <nav className="nav" aria-label="Primary">
        <NavItem to="/" label="Overview" icon={<IconGrid />} />
        <NavItem to="/employees" label="Employees" icon={<IconUsers />} />
        <NavItem to="/rules" label="Rules" icon={<IconShield />} />
        <NavItem to="/reports" label="Reports" icon={<IconReport />} />
      </nav>

    </aside>
  );
}

