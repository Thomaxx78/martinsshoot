import { useRef, useState } from "react";
import PinLock from "./features/auth/PinLock";
import Dashboard from "./features/admin/Dashboard";
import ShootFlow from "./features/shoot/ShootFlow";
import { loadDatabase, saveDatabase } from "./lib/storage";

export default function App() {
  const [database, setDatabase] = useState(loadDatabase);
  const databaseRef = useRef(database);
  const [screen, setScreen] = useState("lock");
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
      <PinLock
        expectedPin={database.settings.pin}
        onUnlock={() => {
          setScreen("dashboard");
          setError("");
        }}
      />
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
          onSave={(shoot) =>
            updateDatabase((next) => {
              const index = next.shoots.findIndex(
                (item) => item.id === shoot.id,
              );
              if (index === -1) next.shoots.push(shoot);
              else next.shoots[index] = shoot;
            })
          }
          onExit={() => setScreen("dashboard")}
        />
      )}
    </main>
  );
}
