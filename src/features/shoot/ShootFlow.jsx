import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { COUNTRIES } from "../../data/countries";
import { TRANSLATIONS } from "../../data/translations";
import { contributionStats, today } from "../../lib/stats";
import {
  emailLink,
  languageFor,
  nextShootReference,
  phoneLink,
  shootFolderName,
} from "../../lib/shoots";
import {
  clearDriveAccess,
  clearGmailAccess,
  connectGmail,
  connectGoogleDrive,
  getDriveAccessToken,
  getGmailAccessToken,
  googleClientId,
  hasDriveAccess,
  hasGmailAccess,
  loadGoogleIdentity,
  martinGoogleEmail,
} from "../../lib/googleDriveAuth";
import { deliveryEmail } from "../../lib/email";
import { sendGmailMessage } from "../../lib/gmail";
import {
  createShootFolder,
  getDriveAccount,
  shareShootFolder,
  uploadShootPhoto,
} from "../../lib/googleDrive";
import { Histogram } from "../admin/Insights";

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  country: "",
  perm: false,
  amount: "",
  method: "",
  link: "",
};

export default function ShootFlow({ settings, shoots, onSave, onExit }) {
  const [step, setStep] = useState("hand");
  const [language, setLanguage] = useState(settings.lang);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [photos, setPhotos] = useState([]);
  const [shootName, setShootName] = useState("");
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [driveReady, setDriveReady] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveAccount, setDriveAccount] = useState("");
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [driveMode, setDriveMode] = useState("auto");
  const [draft, setDraft] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ file: 0, bytes: 0 });
  const draftRef = useRef(null);
  const folderIdRef = useRef("");
  const uploadedRef = useRef(new Set());
  const uploadSessionsRef = useRef(new Map());
  const uploadingRef = useRef(false);
  const emailSendingRef = useRef(false);
  const translation = TRANSLATIONS[language] || TRANSLATIONS.en;
  const stats = contributionStats(shoots);
  const currency = settings.cur;
  const set = (key, value) =>
    setCustomer((previous) => ({ ...previous, [key]: value }));
  const photoUrls = useMemo(
    () => photos.map((photo) => URL.createObjectURL(photo)),
    [photos],
  );

  useEffect(
    () => () => photoUrls.forEach((url) => URL.revokeObjectURL(url)),
    [photoUrls],
  );
  useEffect(() => {
    if (!showQr || !customer.link) {
      setQrImage("");
      return;
    }
    let active = true;
    QRCode.toDataURL(customer.link, { margin: 1, width: 240 })
      .then((image) => {
        if (active) setQrImage(image);
      })
      .catch(() => {
        if (active) setQrImage("");
      });
    return () => {
      active = false;
    };
  }, [showQr, customer.link]);
  useEffect(() => {
    if (step !== "end") return;
    const timer = setTimeout(onExit, 4000);
    return () => clearTimeout(timer);
  }, [step, onExit]);
  useEffect(() => {
    document.body.classList.toggle("gallery-screen", step === "gallery");
    return () => document.body.classList.remove("gallery-screen");
  }, [step]);
  useEffect(() => {
    if (!googleClientId) return;
    let active = true;
    loadGoogleIdentity()
      .then(async () => {
        if (!active) return;
        setDriveReady(true);
        if (hasDriveAccess()) {
          try {
            const email = await getDriveAccount(getDriveAccessToken());
            if (martinGoogleEmail && email.toLowerCase() !== martinGoogleEmail)
              throw new Error("Connect Martin’s Google account to use Drive.");
            if (active) {
              setDriveAccount(email);
              setDriveConnected(true);
            }
          } catch {
            clearDriveAccess();
          }
        }
        if (hasGmailAccess()) {
          try {
            const email = await getDriveAccount(getGmailAccessToken());
            if (martinGoogleEmail && email.toLowerCase() !== martinGoogleEmail)
              throw new Error("Connect Martin’s Google account to use Gmail.");
            if (active) setGmailConnected(true);
          } catch {
            clearGmailAccess();
          }
        }
      })
      .catch((problem) => {
        if (active) {
          setDriveConnected(false);
          setError(problem.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function connectDrive() {
    setDriveConnecting(true);
    setError("");
    try {
      await connectGoogleDrive();
      const email = await getDriveAccount(getDriveAccessToken());
      if (martinGoogleEmail && email.toLowerCase() !== martinGoogleEmail) {
        clearDriveAccess();
        throw new Error("Connect Martin’s Google account to use Drive.");
      }
      setDriveAccount(email);
      setDriveConnected(true);
    } catch (problem) {
      setDriveConnected(false);
      setError(problem.message);
    } finally {
      setDriveConnecting(false);
    }
  }

  async function connectMail() {
    setGmailConnecting(true);
    setError("");
    try {
      await connectGmail();
      const email = await getDriveAccount(getGmailAccessToken());
      if (
        email.toLowerCase() !==
        (driveAccount || martinGoogleEmail).toLowerCase()
      ) {
        clearGmailAccess();
        throw new Error("Gmail must use the same Google account as Drive.");
      }
      setGmailConnected(true);
    } catch (problem) {
      setGmailConnected(false);
      setError(problem.message);
    } finally {
      setGmailConnecting(false);
    }
  }

  function saveDraft(patch) {
    const next = { ...draftRef.current, ...patch };
    if (!onSave(next))
      throw new Error("The shoot could not be saved on this phone.");
    draftRef.current = next;
    setDraft(next);
  }

  async function sendDeliveryEmail(link) {
    if (emailSendingRef.current || draftRef.current.emailStatus === "sent")
      return;
    emailSendingRef.current = true;
    try {
      saveDraft({ emailStatus: "sending" });
      const message = deliveryEmail(settings, draftRef.current, link);
      const emailId = await sendGmailMessage(
        getGmailAccessToken(),
        draftRef.current.email,
        message.subject,
        message.text,
      );
      saveDraft({ emailStatus: "sent", emailId });
    } catch (problem) {
      try {
        saveDraft({ emailStatus: "failed", emailError: problem.message });
      } catch {
        /* App shows storage errors. */
      }
    } finally {
      emailSendingRef.current = false;
    }
  }

  async function uploadToDrive() {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setStep("upload");
    setError("");
    try {
      const token = getDriveAccessToken();
      let folderId = folderIdRef.current;
      if (!folderId) {
        folderId = await createShootFolder(token, draftRef.current.folder);
        folderIdRef.current = folderId;
        saveDraft({ driveFolderId: folderId, uploadStatus: "uploading" });
      }
      for (let index = 0; index < photos.length; index++) {
        if (uploadedRef.current.has(index)) continue;
        setUploadProgress({ file: index + 1, bytes: 0 });
        const session = uploadSessionsRef.current.get(index) || { url: "" };
        uploadSessionsRef.current.set(index, session);
        await uploadShootPhoto(
          token,
          folderId,
          photos[index],
          session,
          (bytes) => {
            setUploadProgress({ file: index + 1, bytes });
          },
        );
        uploadedRef.current.add(index);
        saveDraft({ uploadedPhotos: uploadedRef.current.size });
      }
      const link = await shareShootFolder(token, folderId);
      saveDraft({ link, uploadStatus: "ready" });
      setCustomer((previous) => ({ ...previous, link }));
      setStep("gallery");
      if (draftRef.current.email) {
        if (gmailConnected && hasGmailAccess()) void sendDeliveryEmail(link);
        else saveDraft({ emailStatus: "not_connected" });
      }
    } catch (problem) {
      if (problem.status === 401 || !hasDriveAccess()) setDriveConnected(false);
      try {
        saveDraft({ uploadStatus: "failed" });
      } catch {
        /* App shows storage errors. */
      }
      setError(problem.message || "Google Drive upload failed. Please retry.");
    } finally {
      uploadingRef.current = false;
    }
  }

  function selectPhotos(event) {
    setPhotos(Array.from(event.target.files || []));
  }
  function submitDetails(event) {
    event.preventDefault();
    if (
      !customer.name.trim() ||
      !customer.country.trim() ||
      (!customer.phone.trim() && !customer.email.trim())
    ) {
      setError(translation.need);
      return;
    }
    setError("");
    const date = today();
    const ref = nextShootReference(shoots);
    const shoot = {
      id: crypto.randomUUID(),
      ref,
      date,
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      email: customer.email.trim(),
      country: customer.country.trim(),
      lang: languageFor(customer.country.trim()),
      perm: customer.perm,
      photos: photos.length,
      link: driveMode === "auto" ? "" : customer.link.trim(),
      shootName: shootName.trim(),
      folder: shootFolderName(shootName, customer.name, date, ref),
      driveFolderId: "",
      uploadedPhotos: 0,
      uploadStatus: driveMode === "auto" ? "creating" : "skipped",
      emailStatus: customer.email.trim()
        ? driveMode === "auto"
          ? "waiting_for_photos"
          : "manual"
        : "not_provided",
      amount: 0,
      method: "",
      status: "pending",
    };
    if (!onSave(shoot)) {
      setError("The shoot could not be saved on this phone.");
      return;
    }
    draftRef.current = shoot;
    setDraft(shoot);
    if (driveMode === "auto") void uploadToDrive();
    else setStep("gallery");
  }
  function finish(method = customer.method) {
    if (!draftRef.current) return;
    const next = {
      ...draftRef.current,
      amount: Number(customer.amount),
      method,
      status: method === "cash" ? "cash due" : "paid",
      reviewDue: Date.now() + 20 * 60_000,
      reviewSent: false,
    };
    if (onSave(next)) {
      draftRef.current = next;
      setDraft(next);
      setStep("end");
    }
  }

  const languages = (
    <div className="language-switch" aria-label="Language">
      {["en", "fr", "es"].map((code) => (
        <button
          key={code}
          className={`b sm ${code === language ? "" : "s"}`}
          onClick={() => setLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (step === "hand")
    return (
      <div className="fade">
        <h2>Photos for this shoot</h2>
        <p className="mu">
          Choose the edited photos, then hand the phone to the customer.
        </p>
        <label>
          Shoot name
          <input
            value={shootName}
            onChange={(event) => setShootName(event.target.value)}
            placeholder="Eiffel Tower sunset"
            maxLength={80}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Edited photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={selectPhotos}
          />
        </label>
        <p className="mu">
          {photos.length ? `${photos.length} selected` : "No photos selected"}
        </p>
        <div className="k">
          <h3>Google Drive</h3>
          {googleClientId ? (
            <>
              <p className="mu">
                {driveConnected && hasDriveAccess()
                  ? `Connected: ${driveAccount || "Google Drive"}. The shoot will be saved inside Shoots after the customer form.`
                  : driveReady
                    ? "Connect Martin’s Google account before handing over the phone."
                    : "Loading Google sign-in…"}
              </p>
              <button
                className="b s"
                disabled={!driveReady || driveConnecting}
                onClick={connectDrive}
              >
                {driveConnecting
                  ? "Connecting…"
                  : driveConnected && hasDriveAccess()
                    ? "Reconnect Google Drive"
                    : "Connect Google Drive"}
              </button>
            </>
          ) : (
            <p className="mu">
              Google Drive setup is missing. Add the OAuth Client ID described
              in the README before using automatic upload.
            </p>
          )}
        </div>
        <div className="k">
          <h3>Automatic email</h3>
          <p className="mu small">
            {gmailConnected && hasGmailAccess()
              ? `Gmail connected: ${driveAccount}. Customers who add an email will receive the Drive link automatically.`
              : "Connect Martin’s Gmail to email the Drive link after upload. Drive uploads still work without it."}
          </p>
          <button
            className="b s"
            disabled={
              !driveConnected ||
              !hasDriveAccess() ||
              !driveReady ||
              gmailConnecting
            }
            onClick={connectMail}
          >
            {gmailConnecting
              ? "Connecting…"
              : gmailConnected && hasGmailAccess()
                ? "Reconnect Gmail"
                : "Connect Gmail (Martin)"}
          </button>
        </div>
        <button
          className="b"
          disabled={
            !driveConnected ||
            !hasDriveAccess() ||
            !photos.length ||
            !shootName.trim()
          }
          onClick={() => {
            setDriveMode("auto");
            setError("");
            setStep("intro");
          }}
        >
          Hand to customer
        </button>
        <button
          className="b g"
          disabled={!photos.length || !shootName.trim()}
          onClick={() => {
            setDriveMode("offline");
            setError("");
            setStep("intro");
          }}
        >
          Continue without Drive
        </button>
        {error && (
          <p className="mu" role="alert">
            {error}
          </p>
        )}
        <button className="b g" onClick={onExit}>
          Cancel
        </button>
      </div>
    );

  if (step === "upload") {
    const current = photos[uploadProgress.file - 1];
    const percent = current
      ? Math.min(100, Math.round((uploadProgress.bytes / current.size) * 100))
      : 0;
    return (
      <div className="fade upload-screen" aria-live="polite">
        <h2>Preparing your photos</h2>
        <p className="mu">{draft?.folder}</p>
        {uploadingRef.current ? (
          <>
            <p>
              {uploadProgress.file
                ? `Uploading photo ${uploadProgress.file} of ${photos.length} · ${percent}%`
                : "Creating your Google Drive folder…"}
            </p>
            <progress
              max="100"
              value={percent}
              aria-label="Photo upload progress"
            />
            <p className="mu small">
              Keep this page open until the photos are ready.
            </p>
          </>
        ) : (
          <>
            <p role="alert">{error || "Upload paused."}</p>
            <p className="mu small">
              The existing folder and completed photos will be reused.
            </p>
            <button className="b" onClick={() => void uploadToDrive()}>
              Retry upload
            </button>
            {googleClientId && (
              <button
                className="b s"
                disabled={!driveReady || driveConnecting}
                onClick={connectDrive}
              >
                {driveConnecting ? "Connecting…" : "Reconnect Drive (Martin)"}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (step === "intro")
    return (
      <div className="c fade intro-screen">
        <h1>{translation.ready}</h1>
        <p className="mu">{translation.sub}</p>
        <button className="b" onClick={() => setStep("details")}>
          {translation.look}
        </button>
      </div>
    );

  if (step === "details")
    return (
      <div className="fade">
        {languages}
        <h2>{translation.we}</h2>
        <form onSubmit={submitDetails}>
          <label>
            {translation.name}
            <input
              value={customer.name}
              onChange={(event) => set("name", event.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label>
            {translation.wa}
            <input
              type="tel"
              value={customer.phone}
              onChange={(event) => set("phone", event.target.value)}
              autoComplete="tel"
            />
          </label>
          <label>
            {translation.em}
            <input
              type="email"
              value={customer.email}
              onChange={(event) => set("email", event.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            {translation.co}
            <input
              list="countries"
              value={customer.country}
              onChange={(event) => set("country", event.target.value)}
              required
            />
          </label>
          <datalist id="countries">
            {COUNTRIES.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={customer.perm}
              onChange={(event) => set("perm", event.target.checked)}
            />
            <span>
              {translation.perm} — {translation.yes}
            </span>
          </label>
          {error && (
            <p className="mu" role="alert">
              {error}
            </p>
          )}
          <button className="b">{translation.show}</button>
        </form>
      </div>
    );

  if (step === "gallery")
    return (
      <div className="fade">
        {languages}
        <div className="gal">
          {photoUrls.map((url, index) => (
            <div key={url}>
              <img
                src={url}
                alt={`Photo ${index + 1} of ${photoUrls.length}`}
              />
            </div>
          ))}
          <div>
            <h2>{translation.all(photoUrls.length)}</h2>
            <button className="b" onClick={() => setStep("delivery")}>
              {translation.get}
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "delivery") {
    const message = TRANSLATIONS[language].msg(customer.link);
    const canShare = Boolean(customer.link.trim());
    return (
      <div className="fade">
        {languages}
        <h2>{translation.deliv}</h2>
        {customer.email && draft?.emailStatus === "sending" && (
          <p className="mu small" role="status">
            Sending your email…
          </p>
        )}
        {customer.email && draft?.emailStatus === "sent" && (
          <p className="mu small" role="status">
            Email sent to {customer.email}.
          </p>
        )}
        {customer.email &&
          ["failed", "not_connected"].includes(draft?.emailStatus) && (
            <p className="mu small" role="status">
              Automatic email is unavailable. You can send the link manually
              below.
            </p>
          )}
        {canShare && customer.phone && (
          <a
            className="b"
            target="_blank"
            rel="noreferrer"
            href={phoneLink(customer.phone, message)}
          >
            {translation.swa}
          </a>
        )}
        {canShare && customer.email && (
          <a
            className="b s"
            href={emailLink(customer.email, "Your photos", message)}
          >
            {translation.sem}
          </a>
        )}
        {canShare && (
          <button className="b s" onClick={() => setShowQr(true)}>
            {translation.sqr}
          </button>
        )}
        {showQr && qrImage && (
          <div className="qr c">
            <img src={qrImage} alt="QR code for photo link" />
          </div>
        )}
        {!canShare && (
          <p className="mu">
            No Drive link was added. Download the photos here and share them
            manually.
          </p>
        )}
        <div className="download-list">
          {photoUrls.map((url, index) => (
            <a
              key={url}
              className="b sm s"
              href={url}
              download={photos[index].name}
            >
              Download {index + 1}
            </a>
          ))}
        </div>
        <button className="b" onClick={() => setStep("amount")}>
          {translation.go}
        </button>
      </div>
    );
  }

  if (step === "amount")
    return (
      <div className="fade">
        {languages}
        <h1>{translation.contr}</h1>
        <p className="mu">{translation.ch}</p>
        <div className="amount-input">
          <b>{currency}</b>
          <input
            aria-label="Contribution amount"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={customer.amount}
            onChange={(event) => set("amount", event.target.value)}
          />
        </div>
        <button
          className="b s"
          onClick={() => setShowGuide(!showGuide)}
          aria-expanded={showGuide}
        >
          {translation.ns}
        </button>
        {showGuide && (
          <div className="k">
            <p>{translation.guide}</p>
            {stats && (
              <>
                <p>
                  <b>
                    {translation.avg}: {currency}
                    {stats.average.toFixed(2)}
                  </b>
                  {stats.amounts.length >= 3 && (
                    <>
                      <br />
                      <b>
                        {translation.rng}: {currency}
                        {stats.low.toFixed(2)}–{stats.high.toFixed(2)}
                      </b>
                    </>
                  )}
                </p>
                <Histogram amounts={stats.amounts} currency={currency} />
              </>
            )}
            <p>{translation.wel}</p>
          </div>
        )}
        <button
          className="b"
          onClick={() => {
            if (Number(customer.amount) > 0) {
              setError("");
              setStep("payment");
            } else setError("Choose an amount greater than zero.");
          }}
        >
          {translation.go}
        </button>
        {error && (
          <p className="mu" role="alert">
            {error}
          </p>
        )}
      </div>
    );

  if (step === "payment")
    return (
      <div className="fade">
        {languages}
        <h1>{translation.ty}</h1>
        <p className="mu">{translation.how}</p>
        <button
          className={`b ${customer.method === "revolut" ? "" : "s"}`}
          onClick={() => set("method", "revolut")}
        >
          Revolut / Apple Pay / Google Pay
        </button>
        <button
          className={`b ${customer.method === "paypal" ? "" : "s"}`}
          onClick={() => set("method", "paypal")}
        >
          PayPal
        </button>
        <button
          className={`b ${customer.method === "card" ? "" : "s"}`}
          onClick={() => set("method", "card")}
        >
          {translation.card}
        </button>
        {["revolut", "paypal"].includes(customer.method) && (
          <div className="k c qr">
            {settings[customer.method] ? (
              <img
                src={settings[customer.method]}
                alt={`${customer.method} payment QR code`}
              />
            ) : (
              <p className="mu">No QR uploaded. Add it in Settings.</p>
            )}
            <p>
              <b>
                {currency}
                {customer.amount}
              </b>
            </p>
            <button className="b" onClick={() => finish()}>
              Payment completed ✓
            </button>
          </div>
        )}
        {customer.method === "card" && (
          <div className="k c">
            <div className="st">
              {currency}
              {customer.amount}
            </div>
            {settings.stripeUrl ? (
              <a
                className="b"
                target="_blank"
                rel="noreferrer"
                href={settings.stripeUrl}
              >
                Open Stripe
              </a>
            ) : (
              <p className="mu">
                Open the Stripe app, enter this amount, then tap the card on
                this phone.
              </p>
            )}
            <button className="b s" onClick={() => finish()}>
              Payment completed
            </button>
          </div>
        )}
        <button
          className="b g"
          onClick={() => {
            set("method", "cash");
            setStep("cash-confirm");
          }}
        >
          {translation.cash}
        </button>
      </div>
    );

  if (step === "cash-confirm")
    return (
      <div className="fade c">
        <h2>
          {currency}
          {customer.amount} cash
        </h2>
        <p className="mu">Record this contribution as cash due?</p>
        <button className="b" onClick={() => finish("cash")}>
          Confirm
        </button>
        <button className="b g" onClick={() => setStep("payment")}>
          Back
        </button>
      </div>
    );

  return (
    <div className="c end-screen">
      <div className="chk">✓</div>
      <h2>{translation.done}</h2>
      <button className="b g" onClick={onExit}>
        Dashboard
      </button>
    </div>
  );
}
