import { useEffect, useRef, useState } from "react";
import "./pin-lock.css";

const keys = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
];

export default function PinLock({ expectedPin, onUnlock }) {
  const code = String(expectedPin ?? "1234");
  const usesKeypad = /^\d{4,8}$/.test(code);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const [wrong, setWrong] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  function check(next) {
    if (next === code) {
      onUnlock();
      return;
    }
    setWrong(true);
    setError("Wrong PIN. Try again.");
    resetTimer.current = setTimeout(() => {
      setEntered("");
      setWrong(false);
    }, 650);
  }

  function pressDigit(digit) {
    if (wrong || entered.length >= code.length) return;
    const next = entered + digit;
    setEntered(next);
    setError("");
    if (next.length === code.length) check(next);
  }

  function erase() {
    if (wrong) return;
    setEntered((previous) => previous.slice(0, -1));
    setError("");
  }

  useEffect(() => {
    if (!usesKeypad) return;
    function handleKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pressDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        erase();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (!usesKeypad) {
    return (
      <main className="w c pin-lock pin-lock--legacy">
        <h1>Enter PIN</h1>
        <p className="mu">
          Use your existing PIN, then set a 4–8 digit PIN in Settings.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (entered === code) onUnlock();
            else {
              setEntered("");
              setError("Wrong PIN. Try again.");
            }
          }}
        >
          <input
            aria-label="PIN"
            type="password"
            autoComplete="off"
            value={entered}
            onChange={(event) => setEntered(event.target.value)}
            autoFocus
          />
          <button className="b">Unlock</button>
        </form>
        <p className="pin-feedback" role="alert">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="pin-lock">
      <div className="pin-lock__content">
        <div className="pin-lock__heading">
          <span className="pin-lock__eyebrow">SHOOT MARTIN</span>
          <h1>Enter PIN</h1>
          <p className="mu">Enter your code to continue</p>
        </div>

        <div
          className={`pin-dots ${wrong ? "pin-dots--wrong" : ""}`}
          role="status"
          aria-label={`${entered.length} of ${code.length} digits entered`}
        >
          {Array.from({ length: code.length }, (_, index) => (
            <span
              key={index}
              className={`pin-dot ${index < entered.length ? "pin-dot--filled" : ""}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="pin-feedback" role="alert">
          {error}
        </p>

        <div className="pin-keypad" aria-label="PIN keypad">
          {keys.map(([digit, letters]) => (
            <button
              type="button"
              className="pin-key"
              key={digit}
              onClick={() => pressDigit(digit)}
              disabled={wrong}
              aria-label={digit}
            >
              <span className="pin-key__digit">{digit}</span>
              <span className="pin-key__letters" aria-hidden="true">
                {letters || "\u00a0"}
              </span>
            </button>
          ))}
          <span aria-hidden="true" />
          <button
            type="button"
            className="pin-key"
            onClick={() => pressDigit("0")}
            disabled={wrong}
            aria-label="0"
          >
            <span className="pin-key__digit">0</span>
            <span className="pin-key__letters" aria-hidden="true">
              &nbsp;
            </span>
          </button>
          <button
            type="button"
            className="pin-delete"
            onClick={erase}
            disabled={wrong || !entered}
            aria-label="Delete last digit"
          >
            <svg viewBox="0 0 28 22" fill="none" aria-hidden="true">
              <path
                d="M10 2H25C26.1 2 27 2.9 27 4V18C27 19.1 26.1 20 25 20H10L1 11L10 2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M14 7L21 15M21 7L14 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
