import { FRENCH_COUNTRIES, SPANISH_COUNTRIES } from "../data/countries";

export function languageFor(country) {
  if (FRENCH_COUNTRIES.includes(country)) return "fr";
  if (SPANISH_COUNTRIES.includes(country)) return "es";
  return "en";
}

export function exportCsv(shoots) {
  const columns = [
    "ref",
    "date",
    "name",
    "country",
    "phone",
    "email",
    "amount",
    "method",
    "status",
    "photos",
    "link",
    "notes",
  ];
  const rows = [
    columns.join(","),
    ...shoots.map((shoot) =>
      columns
        .map(
          (column) => `"${String(shoot[column] ?? "").replaceAll('"', '""')}"`,
        )
        .join(","),
    ),
  ];
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "shoots.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function phoneLink(phone, message) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function emailLink(email, subject, message) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
