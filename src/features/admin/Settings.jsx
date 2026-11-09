import { useState } from "react";
import { EMAIL_MESSAGES } from "../../lib/email";
import Field from "./Field";

export default function Settings({ settings, updateDatabase, onLock }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");
  const set = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  function upload(key, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(key, reader.result);
    reader.readAsDataURL(file);
  }
  function save(event) {
    event.preventDefault();
    const saved = updateDatabase((next) => {
      next.settings = { ...form };
    });
    if (saved) setMessage("Saved.");
  }
  return (
    <>
      <form onSubmit={save}>
        <div className="k">
          <h3>Google Drive</h3>
          <p className="mu small">
            Connect your Google account from New photo shoot before handing over
            the phone.
          </p>
          <Field
            label="Account label (optional; does not connect Drive)"
            value={form.drive}
            onChange={(event) => set("drive", event.target.value)}
          />
          <Field
            label="Google review link"
            type="url"
            value={form.review}
            onChange={(event) => set("review", event.target.value)}
          />
        </div>
        <div className="k">
          <h3>Photo delivery email</h3>
          <p className="mu small">
            Choose the message for each language. Use {"{{name}}"},{" "}
            {"{{shoot}}"}, and {"{{link}}"} where the customer name, shoot name,
            and Drive link should appear.
          </p>
          {[
            ["en", "English"],
            ["fr", "Français"],
            ["es", "Español"],
          ].map(([language, label]) => (
            <label key={language}>
              {label}
              <textarea
                rows={5}
                maxLength={2000}
                value={
                  form.emailMessages?.[language] ?? EMAIL_MESSAGES[language]
                }
                onChange={(event) =>
                  set("emailMessages", {
                    ...EMAIL_MESSAGES,
                    ...form.emailMessages,
                    [language]: event.target.value,
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="k">
          <h3>Stripe</h3>
          <Field
            label="Account label"
            value={form.stripe}
            onChange={(event) => set("stripe", event.target.value)}
          />
          <Field
            label="Tap to Pay link / app URL"
            type="url"
            value={form.stripeUrl}
            onChange={(event) => set("stripeUrl", event.target.value)}
          />
        </div>
        {[
          ["revolut", "Revolut / Apple Pay / Google Pay"],
          ["paypal", "PayPal"],
        ].map(([key, label]) => (
          <div className="k" key={key}>
            <h3>{label} QR code</h3>
            {form[key] ? (
              <img
                className="qr-preview"
                src={form[key]}
                alt={`${label} QR code`}
              />
            ) : (
              <p className="mu">None uploaded</p>
            )}
            <input
              aria-label={`Upload ${label} QR code`}
              type="file"
              accept="image/*"
              onChange={(event) => upload(key, event.target.files[0])}
            />
            {form[key] && (
              <button
                type="button"
                className="b sm s"
                onClick={() => set(key, "")}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="k">
          <label>
            Currency
            <select
              value={form.cur}
              onChange={(event) => set("cur", event.target.value)}
            >
              <option value="€">Euro (€)</option>
              <option value="$">US dollar ($)</option>
            </select>
          </label>
          <label>
            Default language
            <select
              value={form.lang}
              onChange={(event) => set("lang", event.target.value)}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="es">ES</option>
            </select>
          </label>
          <Field
            label="Admin PIN (4–8 digits)"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            required
            value={form.pin}
            onChange={(event) => set("pin", event.target.value)}
          />
        </div>
        <button className="b">Save settings</button>
        <p role="status" className="mu">
          {message}
        </p>
      </form>
      <button
        className="b g"
        onClick={() => {
          if (window.confirm("Delete all data?"))
            updateDatabase((next) => {
              next.shoots = [];
            });
        }}
      >
        Reset all shoots
      </button>
      <button className="b g" onClick={onLock}>
        Lock
      </button>
    </>
  );
}
