import React from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ title, subtitle, onLogout, children }) {
  return (
    <div className="app-shell">
      <Sidebar onLogout={onLogout} />
      <div className="main">
        <Topbar title={title} subtitle={subtitle} onLogout={onLogout} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

