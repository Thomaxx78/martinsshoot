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
import { startShootUpload } from "../../lib/backgroundUpload";
import { photoKey } from "../../lib/photoSelection";
import {
  clearDriveAccess,
  clearGmailAccess,
  connectGmail,
  connectGoogleDrive,
  connectPersistentGoogle,
  getDriveAccessToken,
  getGmailAccessToken,
  googleClientId,
  hasDriveAccess,
  hasGmailAccess,
  hasPersistentSession,
  loadGoogleIdentity,
  martinGoogleEmail,
  restoreGoogleSession,
} from "../../lib/googleDriveAuth";
import { getDriveAccount } from "../../lib/googleDrive";
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

export default function ShootFlow({
  settings,
  shoots,
  onSave,
  onPatchShoot,
  onExit,
}) {
  const [step, setStep] = useState("hand");
  const [language, setLanguage] = useState(settings.lang);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [photos, setPhotos] = useState([]);
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
  const [persistentAvailable, setPersistentAvailable] = useState(false);
  const [driveMode, setDriveMode] = useState("auto");
  const [draft, setDraft] = useState(null);
  const draftRef = useRef(null);
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
    Promise.allSettled([loadGoogleIdentity(), restoreGoogleSession()]).then(
      async ([identityResult, sessionResult]) => {
        if (!active) return;
        const session =
          sessionResult.status === "fulfilled"
            ? sessionResult.value
            : { configured: false, connected: false };
        setDriveReady(identityResult.status === "fulfilled");
        setPersistentAvailable(Boolean(session.configured));
        if (session.connected) {
          setDriveAccount(session.email);
          setDriveConnected(true);
          setGmailConnected(true);
          return;
        }
        if (identityResult.status === "rejected") {
          setError(identityResult.reason.message);
          return;
        }
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
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function connectBoth() {
    setDriveConnecting(true);
    setError("");
    try {
      const session = await connectPersistentGoogle();
      setDriveAccount(session.email);
      setDriveConnected(true);
      setGmailConnected(true);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setDriveConnecting(false);
    }
  }

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
      selectedFileKeys: photos.map(photoKey),
      uploadedFileKeys: [],
      link: driveMode === "auto" ? "" : customer.link.trim(),
      shootName: "",
      folder: shootFolderName(customer.name, date, ref),
      driveFolderId: "",
      uploadedPhotos: 0,
      uploadTotalBytes: photos.reduce((total, photo) => total + photo.size, 0),
      uploadedBytes: 0,
      uploadStatus: driveMode === "auto" ? "creating" : "skipped",
      emailStatus: customer.email.trim()
        ? driveMode === "auto"
          ? "waiting_for_link"
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
    setStep("gallery");
    if (driveMode === "auto") {
      startShootUpload({
        shoot,
        files: photos,
        settings,
        onPatchShoot,
        onChange: (patch) => {
          draftRef.current = { ...draftRef.current, ...patch };
          setDraft(draftRef.current);
          if (patch.link)
            setCustomer((previous) => ({ ...previous, link: patch.link }));
        },
      });
    }
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
          {googleClientId && persistentAvailable ? (
            <>
              <p className="mu">
                {driveConnected && hasDriveAccess()
                  ? `Connected: ${driveAccount}. Drive and Gmail will reconnect automatically on this phone for about 7 days.`
                  : driveReady
                    ? "Connect Martin’s Google account before handing over the phone."
                    : "Loading Google sign-in…"}
              </p>
              <button
                className="b s"
                disabled={!driveReady || driveConnecting}
                onClick={connectBoth}
              >
                {driveConnecting
                  ? "Connecting…"
                  : driveConnected && hasDriveAccess()
                    ? "Reconnect Google"
                    : "Connect Google (Drive + Gmail)"}
              </button>
            </>
          ) : googleClientId ? (
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
        {!persistentAvailable && (
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
        )}
        <button
          className="b"
          disabled={
            !driveConnected ||
            (!hasDriveAccess() && !hasPersistentSession()) ||
            !photos.length
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
          disabled={!photos.length}
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
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
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
    const message =
      driveMode === "auto" && draft?.uploadStatus !== "ready"
        ? TRANSLATIONS[language].msgPending(customer.link)
        : TRANSLATIONS[language].msg(customer.link);
    const canShare = Boolean(customer.link.trim());
    const waitingForLink =
      driveMode === "auto" && !canShare && draft?.uploadStatus !== "failed";
    const linkFailed =
      driveMode === "auto" && !canShare && draft?.uploadStatus === "failed";
    return (
      <div className="fade">
        {languages}
        <h2>
          {waitingForLink
            ? translation.linkPending
            : linkFailed
              ? translation.linkFailed
              : canShare && draft?.uploadStatus !== "ready"
                ? translation.linkUploading
                : translation.deliv}
        </h2>
        {linkFailed && draft?.uploadError && (
          <p className="mu small" role="alert">
            {draft.uploadError}
          </p>
        )}
        {customer.email && draft?.emailStatus === "sending" && (
          <p className="mu small" role="status">
            Sending your email…
          </p>
        )}
        {customer.email && draft?.emailStatus === "sent" && (
          <p className="mu small" role="status">
            {translation.emailAccepted} {customer.email}.
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
        {!canShare && driveMode !== "auto" && (
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
        <button
          className="b"
          disabled={waitingForLink || linkFailed}
          onClick={() => setStep("amount")}
        >
          {translation.go}
        </button>
        {!canShare && driveMode === "auto" && (
          <button className="b g" onClick={() => setStep("amount")}>
            {translation.linkLater}
          </button>
        )}
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
      {driveMode === "auto" && draft?.uploadStatus !== "ready" && (
        <p className="mu small">{translation.keepOpen}</p>
      )}
      <button className="b g" onClick={onExit}>
        Dashboard
      </button>
    </div>
  );
}
