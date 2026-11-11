import { UPLOAD_STATUS_TEXT } from "../../data/uploadStatus";
import { hasShootUploadTask } from "../../lib/backgroundUpload";
import { uploadPercent } from "../../lib/uploadProgress";
import EmailHistory from "./EmailHistory";

export default function DeliveryHistory({ shoots, onOpenCustomers }) {
  const uploads = shoots
    .filter((shoot) => shoot.uploadStatus && shoot.uploadStatus !== "skipped")
    .reverse();
  const completed = uploads.filter(
    (shoot) => shoot.uploadStatus === "ready",
  ).length;

  return (
    <details className="delivery-archive">
      <summary className="delivery-archive__toggle">
        <span className="delivery-archive__mark" aria-hidden="true">
          ☷
        </span>
        <span className="delivery-archive__heading">
          <strong>Transfer history</strong>
          <span>
            {uploads.length
              ? `${completed} complete · ${uploads.length} total`
              : "Drive uploads and Gmail delivery"}
          </span>
        </span>
        <span className="delivery-archive__chevron" aria-hidden="true" />
      </summary>
      <div className="delivery-archive__body">
        {uploads.length ? (
          uploads.map((shoot) => {
            const ready = shoot.uploadStatus === "ready";
            const interrupted =
              !ready &&
              shoot.uploadStatus !== "failed" &&
              !hasShootUploadTask(shoot.id);
            const state = interrupted
              ? "Interrupted"
              : UPLOAD_STATUS_TEXT[shoot.uploadStatus] || "In progress";
            const tone = ready
              ? "success"
              : interrupted || shoot.uploadStatus === "failed"
                ? "warning"
                : "neutral";
            return (
              <article className="delivery-entry" key={shoot.id}>
                <div className="delivery-entry__header">
                  <div>
                    <strong>{shoot.name}</strong>
                    <span className="delivery-entry__meta">
                      {shoot.date} · {shoot.ref}
                    </span>
                  </div>
                  <span className={`delivery-pill delivery-pill--${tone}`}>
                    {state}
                  </span>
                </div>
                <div className="delivery-entry__checks">
                  <div className="delivery-entry__drive">
                    <span className="delivery-entry__label">Google Drive</span>
                    <strong>
                      {ready
                        ? "Photos uploaded"
                        : `${uploadPercent(shoot)}% uploaded`}
                    </strong>
                    <span className="delivery-entry__meta">
                      {shoot.uploadedPhotos || 0}/{shoot.photos || 0} photos
                      {ready && shoot.uploadCompletedAt
                        ? ` · ${new Date(shoot.uploadCompletedAt).toLocaleString()}`
                        : ""}
                    </span>
                    {shoot.link && (
                      <a href={shoot.link} target="_blank" rel="noreferrer">
                        Open Drive folder ↗
                      </a>
                    )}
                    {shoot.uploadError && !ready && (
                      <span className="delivery-entry__error">
                        {shoot.uploadError}
                      </span>
                    )}
                  </div>
                  <EmailHistory shoot={shoot} expanded />
                </div>
              </article>
            );
          })
        ) : (
          <p className="mu small">No Drive uploads recorded yet.</p>
        )}
        <button className="b sm s" onClick={onOpenCustomers}>
          Open Customers
        </button>
      </div>
    </details>
  );
}
