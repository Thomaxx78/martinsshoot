import { useState } from "react";
import Insights from "./Insights";
import Home from "./Home";
import Customers from "./Customers";
import AddPast from "./AddPast";
import Settings from "./Settings";

const tabs = [
  ["home", "Home"],
  ["customers", "Customers"],
  ["stats", "Insights"],
  ["past", "Add past"],
  ["settings", "Settings"],
];

export default function Dashboard({
  database,
  updateDatabase,
  onNewShoot,
  onLock,
}) {
  const [tab, setTab] = useState("home");
  return (
    <div className="fade">
      <h2>Dashboard</h2>
      <nav className="tabs" aria-label="Dashboard">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={`b sm ${tab === key ? "" : "s"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "home" && (
        <Home
          database={database}
          updateDatabase={updateDatabase}
          onNewShoot={onNewShoot}
        />
      )}
      {tab === "customers" && (
        <Customers database={database} updateDatabase={updateDatabase} />
      )}
      {tab === "stats" && (
        <Insights shoots={database.shoots} currency={database.settings.cur} />
      )}
      {tab === "past" && <AddPast updateDatabase={updateDatabase} />}
      {tab === "settings" && (
        <Settings
          settings={database.settings}
          updateDatabase={updateDatabase}
          onLock={onLock}
        />
      )}
    </div>
  );
}
