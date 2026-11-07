import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { COUNTRIES } from "../../data/countries";
import { TRANSLATIONS } from "../../data/translations";
import { contributionStats, today } from "../../lib/stats";
import { emailLink, languageFor, phoneLink } from "../../lib/shoots";
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
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrImage, setQrImage] = useState("");
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
    setStep("gallery");
  }
  function finish(method = customer.method) {
    const date = today();
    const ref = `REF-${String(shoots.length + 1).padStart(6, "0")}`;
    const saved = onSave({
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
      link: customer.link.trim(),
      folder: `${customer.name.trim()} – ${date} – ${ref}`,
      amount: Number(customer.amount),
      method,
      status: method === "cash" ? "cash due" : "paid",
      reviewDue: Date.now() + 20 * 60_000,
      reviewSent: false,
    });
    if (saved) setStep("end");
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
        <label>
          Real Google Drive share link (optional)
          <input
            type="url"
            placeholder="https://drive.google.com/drive/folders/…"
            value={customer.link}
            onChange={(event) => set("link", event.target.value)}
          />
        </label>
        <p className="mu small">
          Photos stay on this device. To send them later, upload them to Drive
          yourself and paste the actual share link here.
        </p>
        <button
          className="b"
          onClick={() => {
            if (!photos.length) {
              setError("Select photos first.");
              return;
            }
            setError("");
            setStep("intro");
          }}
        >
          Hand to customer
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
