import { useRef, useState } from "react";
import Dashboard from "./features/admin/Dashboard";
import ShootFlow from "./features/shoot/ShootFlow";
import { loadDatabase, saveDatabase } from "./lib/storage";

export default function App() {
  const [database, setDatabase] = useState(loadDatabase);
  const databaseRef = useRef(database);
  const [screen, setScreen] = useState("lock");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function updateDatabase(change) {
    const next = structuredClone(databaseRef.current);
    change(next);
    try {
      saveDatabase(next);
    } catch {
      setError(
        "Storage full or unavailable. Your latest change was not saved.",
      );
      return false;
    }
    databaseRef.current = next;
    setDatabase(next);
    setError("");
    return true;
  }

  if (screen === "lock") {
    return (
      <main className="w c lock-screen">
        <h1>Enter PIN</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (pin === database.settings.pin) {
              setScreen("dashboard");
              setError("");
              setPin("");
            } else setError("Wrong PIN.");
          }}
        >
          <input
            aria-label="PIN"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoFocus
          />
          <button className="b">Unlock</button>
        </form>
        <p role="alert" className="mu">
          {error}
        </p>
        <p className="mu small">Default PIN: 1234 — change it in Settings.</p>
      </main>
    );
  }

  return (
    <main className="w">
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {screen === "dashboard" ? (
        <Dashboard
          database={database}
          updateDatabase={updateDatabase}
          onNewShoot={() => setScreen("shoot")}
          onLock={() => setScreen("lock")}
        />
      ) : (
        <ShootFlow
          settings={database.settings}
          shoots={database.shoots}
          onSave={(shoot) => updateDatabase((next) => next.shoots.push(shoot))}
          onExit={() => setScreen("dashboard")}
        />
      )}
    </main>
  );
}
