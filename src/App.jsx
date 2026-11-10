import { useEffect, useRef, useState } from "react";
import PinLock from "./features/auth/PinLock";
import Dashboard from "./features/admin/Dashboard";
import ShootFlow from "./features/shoot/ShootFlow";
import { loadDatabase, saveDatabase } from "./lib/storage";
import { hasActiveUploads } from "./lib/backgroundUpload";
import { isNativeAndroid, ShootNative } from "./lib/native";

export default function App() {
  const [database, setDatabase] = useState(loadDatabase);
  const databaseRef = useRef(database);
  const [screen, setScreen] = useState("lock");
  const [error, setError] = useState("");

  useEffect(() => {
    const warnDuringUpload = (event) => {
      if (!hasActiveUploads()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnDuringUpload);
    return () => window.removeEventListener("beforeunload", warnDuringUpload);
  }, []);

  useEffect(() => {
    if (!isNativeAndroid) return;
    let active = true;
    async function syncUploads() {
      const pending = databaseRef.current.shoots.filter((shoot) =>
        ["uploading", "failed"].includes(shoot.uploadStatus),
      );
      if (!pending.length) return;
      try {
        const result = await ShootNative.statuses({
          shootIds: pending.map((shoot) => shoot.id),
        });
        if (!active) return;
        const changed = pending.some((shoot) => {
          const status = result.statuses?.[shoot.id];
          return (
            status &&
            ((["ready", "failed"].includes(status.uploadStatus) &&
              status.uploadStatus !== shoot.uploadStatus) ||
              (status.uploadedPhotos || 0) > (shoot.uploadedPhotos || 0) ||
              (status.uploadError || "") !== (shoot.uploadError || ""))
          );
        });
        if (!changed) return;
        updateDatabase((next) => {
          for (const shoot of next.shoots) {
            const status = result.statuses?.[shoot.id];
            if (!status) continue;
            if (
              status.uploadStatus === "ready" ||
              status.uploadStatus === "failed"
            )
              shoot.uploadStatus = status.uploadStatus;
            shoot.uploadedPhotos = Math.max(
              shoot.uploadedPhotos || 0,
              status.uploadedPhotos || 0,
            );
            shoot.uploadError = status.uploadError || "";
          }
        });
      } catch {
        // The native queue will be checked again when the app resumes.
      }
    }
    const interval = setInterval(syncUploads, 5000);
    const resumed = () => {
      if (!document.hidden) void syncUploads();
    };
    document.addEventListener("visibilitychange", resumed);
    void syncUploads();
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resumed);
    };
  }, []);

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
          onPatchShoot={(id, patch) =>
            updateDatabase((next) => {
              const item = next.shoots.find((shoot) => shoot.id === id);
              if (item) Object.assign(item, patch);
            })
          }
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
