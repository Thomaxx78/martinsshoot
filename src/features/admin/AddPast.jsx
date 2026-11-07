import { useState } from "react";
import { COUNTRIES } from "../../data/countries";
import { languageFor } from "../../lib/shoots";
import Field from "./Field";

export default function AddPast({ updateDatabase }) {
  const empty = {
    date: "",
    name: "",
    country: "",
    amount: "",
    photos: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  function save(event) {
    event.preventDefault();
    if (!Object.values(form).some((value) => String(value).trim())) {
      setMessage("Enter at least one detail.");
      return;
    }
    const saved = updateDatabase((next) =>
      next.shoots.push({
        id: crypto.randomUUID(),
        ref: "PAST",
        date: form.date,
        name: form.name || "Past customer",
        country: form.country,
        amount: Number(form.amount) || 0,
        photos: Number(form.photos) || 0,
        notes: form.notes,
        status: "paid",
        method: "past",
        lang: languageFor(form.country),
      }),
    );
    if (saved) {
      setForm(empty);
      setMessage("Saved. Add another, or check Insights.");
    }
  }
  return (
    <div className="k">
      <h3>Add past shoot</h3>
      <p className="mu">Everything is optional — even just an amount works.</p>
      <form onSubmit={save}>
        {[
          ["date", "Date", "date"],
          ["name", "Customer name"],
          ["country", "Country"],
          ["amount", "Amount contributed", "number"],
          ["photos", "Number of photos", "number"],
        ].map(([key, label, type]) => (
          <Field
            key={key}
            label={`${label} (optional)`}
            type={type || "text"}
            list={key === "country" ? "countries" : undefined}
            value={form[key]}
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
          Notes
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
          />
        </label>
        <button className="b">Save past shoot</button>
      </form>
      <p className="mu" role="status">
        {message}
      </p>
    </div>
  );
}
