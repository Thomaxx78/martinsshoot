import { useState } from "react";
import { COUNTRIES } from "../../data/countries";
import { exportCsv, languageFor } from "../../lib/shoots";
import Field from "./Field";

export default function Customers({ database, updateDatabase }) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const shoots = database.shoots;
  const shown = shoots
    .filter((shoot) =>
      JSON.stringify(shoot).toLowerCase().includes(query.toLowerCase()),
    )
    .reverse();

  function edit(shoot) {
    setEditingId(shoot.id);
    setForm({ ...shoot });
  }
  function save(event) {
    event.preventDefault();
    const saved = updateDatabase((next) => {
      const index = next.shoots.findIndex((shoot) => shoot.id === editingId);
      if (index >= 0)
        next.shoots[index] = {
          ...form,
          amount: Number(form.amount) || 0,
          photos: Number(form.photos) || 0,
          lang: languageFor(form.country),
        };
    });
    if (saved) setEditingId(null);
  }
  function remove() {
    if (!window.confirm("Delete this customer?")) return;
    const removed = updateDatabase((next) => {
      next.shoots = next.shoots.filter((shoot) => shoot.id !== editingId);
    });
    if (removed) setEditingId(null);
  }

  if (editingId && form)
    return (
      <div className="k">
        <h3>Edit customer</h3>
        <form onSubmit={save}>
          {[
            ["name", "Name"],
            ["date", "Date", "date"],
            ["phone", "WhatsApp", "tel"],
            ["email", "Email", "email"],
            ["country", "Country"],
            ["amount", "Amount", "number"],
            ["photos", "Photos", "number"],
            ["link", "Drive link", "url"],
          ].map(([key, label, type]) => (
            <Field
              key={key}
              label={label}
              type={type || "text"}
              value={form[key] ?? ""}
              onChange={(event) =>
                setForm({ ...form, [key]: event.target.value })
              }
            />
          ))}
          <datalist id="countries">
            {COUNTRIES.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
          <label>
            Payment method
            <select
              value={form.method || ""}
              onChange={(event) =>
                setForm({ ...form, method: event.target.value })
              }
            >
              {["", "revolut", "paypal", "card", "cash", "past"].map(
                (method) => (
                  <option key={method} value={method}>
                    {method || "—"}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Status
            <select
              value={form.status || "pending"}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              {["paid", "pending", "cash due"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <textarea
              value={form.notes || ""}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>
          <button className="b">Save changes</button>
        </form>
        <button className="b g" onClick={() => setEditingId(null)}>
          Cancel
        </button>
        <button className="b g" onClick={remove}>
          Delete customer
        </button>
      </div>
    );

  return (
    <>
      <input
        aria-label="Search customers"
        placeholder="Search name, phone, email, country, ref, date"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length ? (
        shown.map((shoot) => (
          <div className="k" key={shoot.id}>
            <b>{shoot.name}</b>{" "}
            <span className="mu">
              {shoot.ref} · {shoot.date}
            </span>
            <br />
            <span className="mu">
              {shoot.country} · {shoot.phone || ""} {shoot.email || ""}
            </span>
            <div className="row">
              <span>
                {database.settings.cur}
                {shoot.amount || 0} · {shoot.method || "—"} · {shoot.status}
              </span>
              <span>{shoot.photos || 0} photos</span>
            </div>
            {shoot.link && (
              <a href={shoot.link} target="_blank" rel="noreferrer">
                Drive folder
              </a>
            )}
            {shoot.driveFolderId && !shoot.link && (
              <a
                href={`https://drive.google.com/drive/folders/${encodeURIComponent(shoot.driveFolderId)}`}
                target="_blank"
                rel="noreferrer"
              >
                Drive folder (private)
              </a>
            )}
            {shoot.uploadStatus &&
              !["ready", "skipped"].includes(shoot.uploadStatus) && (
                <p className="mu small">
                  Drive upload: {shoot.uploadStatus} ·{" "}
                  {shoot.uploadedPhotos || 0}/{shoot.photos || 0} photos
                </p>
              )}
            {shoot.status !== "paid" && (
              <button
                className="b sm s"
                onClick={() =>
                  updateDatabase((next) => {
                    const item = next.shoots.find(
                      (value) => value.id === shoot.id,
                    );
                    if (item) item.status = "paid";
                  })
                }
              >
                Mark paid
              </button>
            )}
            <button className="b sm s" onClick={() => edit(shoot)}>
              Edit
            </button>
          </div>
        ))
      ) : (
        <p className="mu">No matches.</p>
      )}
      <button className="b s" onClick={() => exportCsv(shoots)}>
        Export CSV
      </button>
    </>
  );
}
