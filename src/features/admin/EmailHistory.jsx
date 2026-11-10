import { EMAIL_STATUS_TEXT } from "../../data/emailStatus";

export default function EmailHistory({ shoot }) {
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
  return (
    <div className="email-history">
      <p className="mu small">
        Email: {status}
        {recipient && shoot.emailStatus !== "not_provided"
          ? ` · ${recipient}`
          : ""}
        {statusAt ? ` · ${new Date(statusAt).toLocaleString()}` : ""}
      </p>
      {shoot.emailStatus === "failed" && shoot.emailError && (
        <p className="mu small" role="alert">
          {shoot.emailError}
        </p>
      )}
      {attempts.length > 0 && (
        <details>
          <summary>Email history ({attempts.length})</summary>
          <ol>
            {[...attempts].reverse().map((attempt, index) => (
              <li key={`${attempt.at}-${index}`}>
                {attempt.status === "sent" ? "Gmail accepted" : "Send failed"}
                {attempt.recipient ? ` · ${attempt.recipient}` : ""}
                {attempt.at
                  ? ` · ${new Date(attempt.at).toLocaleString()}`
                  : ""}
                {attempt.source === "manual" ? " · from Customers" : ""}
                {attempt.status === "sent" && attempt.gmailId
                  ? ` · Gmail ID ${attempt.gmailId}`
                  : ""}
                {attempt.status === "failed" && attempt.error
                  ? ` · ${attempt.error}`
                  : ""}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
