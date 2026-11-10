import { REVIEW_MESSAGES } from "../../data/translations";
import { hasShootUploadTask } from "../../lib/backgroundUpload";
import { contributionStats, revenue, today } from "../../lib/stats";
import { uploadPercent } from "../../lib/uploadProgress";
import { emailLink, phoneLink } from "../../lib/shoots";
import EmailHistory from "./EmailHistory";

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
  const recentCompletedUploads = shoots
    .map((shoot, index) => ({ shoot, index }))
    .filter(({ shoot }) => shoot.uploadStatus === "ready")
    .sort(
      (a, b) =>
        (b.shoot.uploadCompletedAt || 0) - (a.shoot.uploadCompletedAt || 0) ||
        b.index - a.index,
    )
    .slice(0, 5)
    .map(({ shoot }) => shoot);
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
        <div className="k" role="status">
          <b>Google Drive transfers</b>
          {pendingUploads.map((shoot) => {
            const active = hasShootUploadTask(shoot.id);
            const percent = uploadPercent(shoot);
            return (
              <div className="upload-item" key={shoot.id}>
                <p className="mu small">
                  {shoot.name} · {percent}% · {shoot.uploadedPhotos || 0}/
                  {shoot.photos || 0} photos
                </p>
                <progress
                  max="100"
                  value={percent}
                  aria-label={`Drive upload for ${shoot.name}`}
                />
                <p className="mu small">
                  {!active
                    ? "Interrupted — reselect the original photos in Customers."
                    : shoot.uploadStatus === "retrying"
                      ? "Connection interrupted. Automatic retry scheduled; you can also retry now in Customers."
                      : shoot.uploadStatus === "failed"
                        ? "Action needed — open Customers."
                        : "Upload in progress."}
                </p>
                <EmailHistory shoot={shoot} />
              </div>
            );
          })}
          <p className="mu small">
            Keep this site open on this phone until the transfer is complete. A
            locked phone may pause the upload.
          </p>
          <button className="b sm s" onClick={onOpenCustomers}>
            Manage transfers
          </button>
        </div>
      )}
      <div className="k">
        <h3>Recent Drive and email deliveries</h3>
        {recentCompletedUploads.length ? (
          recentCompletedUploads.map((shoot) => (
            <div className="upload-item" key={shoot.id}>
              <b>{shoot.name}</b>{" "}
              <span className="mu small">
                {shoot.ref} · {shoot.date}
              </span>
              <p className="mu small">
                Upload complete · {shoot.uploadedPhotos || 0}/
                {shoot.photos || 0} photos
                {shoot.uploadCompletedAt
                  ? ` · ${new Date(shoot.uploadCompletedAt).toLocaleString()}`
                  : ""}
              </p>
              <EmailHistory shoot={shoot} />
              {shoot.link && (
                <a href={shoot.link} target="_blank" rel="noreferrer">
                  Check photos in Drive
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="mu small">No completed Drive uploads yet.</p>
        )}
        <button className="b sm s" onClick={onOpenCustomers}>
          See all customers
        </button>
      </div>
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
    </>
  );
}
