import { REVIEW_MESSAGES } from "../../data/translations";
import { hasShootUploadTask } from "../../lib/backgroundUpload";
import { contributionStats, revenue, today } from "../../lib/stats";
import { uploadPercent } from "../../lib/uploadProgress";
import { emailLink, phoneLink } from "../../lib/shoots";
import EmailHistory from "./EmailHistory";
import DeliveryHistory from "./DeliveryHistory";

export default function Home({
  database,
  updateDatabase,
  onNewShoot,
  onOpenCustomers,
}) {
  const { shoots, settings } = database;
  const stats = contributionStats(shoots);
  const currentDate = today();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekDate = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
  const month = currentDate.slice(0, 7);
  const summary = [
    ["Today", revenue(shoots, (shoot) => shoot.date === currentDate)],
    ["This week", revenue(shoots, (shoot) => shoot.date >= weekDate)],
    ["This month", revenue(shoots, (shoot) => shoot.date?.startsWith(month))],
    ["All time", revenue(shoots)],
  ];
  const due = shoots.filter(
    (shoot) =>
      shoot.reviewDue && !shoot.reviewSent && Date.now() >= shoot.reviewDue,
  );
  const pendingUploads = shoots.filter((shoot) =>
    ["creating", "sharing", "uploading", "retrying", "failed"].includes(
      shoot.uploadStatus,
    ),
  );
  const markReviewSent = (id) =>
    updateDatabase((next) => {
      const shoot = next.shoots.find((item) => item.id === id);
      if (shoot) shoot.reviewSent = true;
    });

  return (
    <>
      <button className="b" onClick={onNewShoot}>
        New photo shoot
      </button>
      {pendingUploads.length > 0 && (
        <div className="k live-transfers" role="status">
          <div className="live-transfers__header">
            <span className="live-transfers__mark" aria-hidden="true">
              ↑
            </span>
            <div>
              <strong>Google Drive transfers</strong>
              <span>Follow each shoot until it finishes</span>
            </div>
            <span className="delivery-pill delivery-pill--neutral">
              {pendingUploads.length} to check
            </span>
          </div>
          {pendingUploads.map((shoot) => {
            const active = hasShootUploadTask(shoot.id);
            const percent = uploadPercent(shoot);
            return (
              <div className="live-transfers__item" key={shoot.id}>
                <div className="live-transfers__item-top">
                  <strong>{shoot.name}</strong>
                  <b>{percent}%</b>
                </div>
                <span className="delivery-entry__meta">
                  {shoot.uploadedPhotos || 0}/{shoot.photos || 0} photos
                </span>
                <progress
                  max="100"
                  value={percent}
                  aria-label={`Drive upload for ${shoot.name}`}
                />
                <p className="mu small">
                  {shoot.uploadStatus === "failed"
                    ? "Action needed — open Customers to resume."
                    : !active
                      ? "Interrupted — reselect the original photos in Customers."
                      : shoot.uploadStatus === "retrying"
                        ? "Connection interrupted. Automatic retry scheduled; you can also retry now in Customers."
                        : "Upload in progress."}
                </p>
                {shoot.uploadError &&
                  ["failed", "retrying"].includes(shoot.uploadStatus) && (
                    <p className="live-transfers__error" role="alert">
                      {shoot.uploadError}
                    </p>
                  )}
                <EmailHistory shoot={shoot} />
              </div>
            );
          })}
          <p className="live-transfers__note">
            Keep this site open on this phone until the transfer is complete. A
            locked phone may pause the upload.
          </p>
          <button className="b sm s" onClick={onOpenCustomers}>
            Manage transfers
          </button>
        </div>
      )}
      <div className="g2">
        {summary.map(([label, amount]) => (
          <div className="k" key={label}>
            <div className="st">
              {settings.cur}
              {amount}
            </div>
            {label}
          </div>
        ))}
        <div className="k">
          <div className="st">
            {stats ? `${settings.cur}${stats.average.toFixed(2)}` : "—"}
          </div>
          Average contribution
        </div>
        <div className="k">
          <div className="st">
            {stats ? `${settings.cur}${stats.median.toFixed(2)}` : "—"}
          </div>
          Median contribution
        </div>
        <div className="k">
          <div className="st">{shoots.length}</div>Shoots
        </div>
        <div className="k">
          <div className="st">
            {shoots.reduce(
              (sum, shoot) => sum + (Number(shoot.photos) || 0),
              0,
            )}
          </div>
          Photos recorded
        </div>
      </div>
      {due.length > 0 && (
        <>
          <h3>Review requests due</h3>
          {due.map((shoot) => {
            const message = `${REVIEW_MESSAGES[shoot.lang] || REVIEW_MESSAGES.en}${settings.review}`;
            return (
              <div className="k" key={shoot.id}>
                {shoot.name}
                <br />
                {shoot.phone && (
                  <a
                    className="b sm"
                    target="_blank"
                    rel="noreferrer"
                    href={phoneLink(shoot.phone, message)}
                    onClick={() => markReviewSent(shoot.id)}
                  >
                    WhatsApp
                  </a>
                )}
                {shoot.email && (
                  <a
                    className="b sm s"
                    href={emailLink(shoot.email, "Review", message)}
                    onClick={() => markReviewSent(shoot.id)}
                  >
                    Email
                  </a>
                )}
              </div>
            );
          })}
        </>
      )}
      <h3>Recent activity</h3>
      {shoots.length ? (
        shoots
          .slice(-5)
          .reverse()
          .map((shoot) => (
            <div className="row" key={shoot.id}>
              <span>
                {shoot.shootName ? `${shoot.shootName} · ` : ""}
                {shoot.name} · {shoot.date}
              </span>
              <b>
                {settings.cur}
                {shoot.amount || 0}
              </b>
            </div>
          ))
      ) : (
        <p className="mu">No shoots yet. Start one above or add past shoots.</p>
      )}
      <DeliveryHistory shoots={shoots} onOpenCustomers={onOpenCustomers} />
    </>
  );
}
