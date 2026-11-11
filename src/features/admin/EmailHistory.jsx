import { EMAIL_STATUS_TEXT } from "../../data/emailStatus";

export default function EmailHistory({ shoot, expanded = false }) {
  const attempts = Array.isArray(shoot.emailHistory) ? shoot.emailHistory : [];
  const latestAttempt = attempts.at(-1);
  const status = EMAIL_STATUS_TEXT[shoot.emailStatus] || "Not sent";
  const recipient =
    latestAttempt?.recipient ||
    (["sent", "failed"].includes(shoot.emailStatus) ? "" : shoot.email);
  const statusAt =
    shoot.emailStatus === "sent"
      ? shoot.emailSentAt ||
        (latestAttempt?.status === "sent" ? latestAttempt.at : 0)
      : shoot.emailStatus === "failed" && latestAttempt?.status === "failed"
        ? latestAttempt.at
        : 0;
  const tone =
    shoot.emailStatus === "sent"
      ? "success"
      : ["failed", "unknown"].includes(shoot.emailStatus)
        ? "warning"
        : "neutral";
  const attemptList = (
    <ol className="email-history__attempts">
      {[...attempts].reverse().map((attempt, index) => (
        <li key={`${attempt.at}-${index}`}>
          <span
            className={`delivery-pill delivery-pill--${attempt.status === "sent" ? "success" : "warning"}`}
          >
            {attempt.status === "sent" ? "Accepted" : "Failed"}
          </span>
          <span className="email-history__attempt-meta">
            {attempt.at
              ? new Date(attempt.at).toLocaleString()
              : "Date unknown"}
            {attempt.source === "manual" ? " · from Customers" : ""}
          </span>
          {attempt.recipient && (
            <span className="email-history__attempt-detail">
              {attempt.recipient}
            </span>
          )}
          {attempt.status === "failed" && attempt.error && (
            <span className="email-history__attempt-detail">
              {attempt.error}
            </span>
          )}
          {attempt.status === "sent" && attempt.gmailId && (
            <span className="email-history__attempt-id">
              Gmail ID {attempt.gmailId}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
  return (
    <div
      className={`email-history${expanded ? " email-history--expanded" : ""}`}
    >
      <div className="email-history__heading">
        <span className="delivery-entry__label">Gmail</span>
        <span className={`email-history__state email-history__state--${tone}`}>
          {status}
        </span>
        {recipient && shoot.emailStatus !== "not_provided" && (
          <span className="email-history__recipient">{recipient}</span>
        )}
        {statusAt > 0 && (
          <span className="delivery-entry__meta">
            {new Date(statusAt).toLocaleString()}
          </span>
        )}
      </div>
      {shoot.emailStatus === "failed" && shoot.emailError && (
        <p className="email-history__error" role="alert">
          {shoot.emailError}
        </p>
      )}
      {attempts.length > 0 &&
        (expanded ? (
          <div className="email-history__log">
            <span className="email-history__log-title">
              {attempts.length} Gmail{" "}
              {attempts.length === 1 ? "attempt" : "attempts"}
            </span>
            {attemptList}
          </div>
        ) : (
          <details className="email-history__details">
            <summary>Email history ({attempts.length})</summary>
            {attemptList}
          </details>
        ))}
    </div>
  );
}
