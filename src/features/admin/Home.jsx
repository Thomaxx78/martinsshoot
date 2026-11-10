import { REVIEW_MESSAGES } from "../../data/translations";
import { isShootUploadRunning } from "../../lib/backgroundUpload";
import { isNativeAndroid } from "../../lib/native";
import { contributionStats, revenue, today } from "../../lib/stats";
import { emailLink, phoneLink } from "../../lib/shoots";

export default function Home({ database, updateDatabase, onNewShoot }) {
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
  const uploading = shoots.filter((shoot) =>
    ["creating", "sharing", "uploading"].includes(shoot.uploadStatus),
  );
  const runningUploads = uploading.filter(
    (shoot) => isNativeAndroid || isShootUploadRunning(shoot.id),
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
      {runningUploads.length > 0 && (
        <div className="k" role="status">
          <b>Drive upload in progress</b>
          {runningUploads.map((shoot) => (
            <p className="mu small" key={shoot.id}>
              {shoot.name}: {shoot.uploadedPhotos || 0}/{shoot.photos || 0}{" "}
              photos
            </p>
          ))}
          <p className="mu small">
            {isNativeAndroid
              ? "Android continues the transfer with a notification, even when the screen is locked."
              : "The customer can finish while photos upload. Keep this web app open until the transfer is complete."}
          </p>
        </div>
      )}
      {!isNativeAndroid && uploading.length > runningUploads.length && (
        <div className="k" role="alert">
          A Drive upload was interrupted. Open Customers and reselect its
          original photos to resume.
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
    </>
  );
}
