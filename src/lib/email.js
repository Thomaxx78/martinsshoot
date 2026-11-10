export const EMAIL_MESSAGES = {
  en: "Hi {{name}},\n\nHere are your photos from {{shoot}}:\n{{link}}\n\nThank you,\nMartin",
  fr: "Bonjour {{name}},\n\nVoici vos photos du shooting {{shoot}} :\n{{link}}\n\nMerci,\nMartin",
  es: "Hola {{name}},\n\nAquí tienes tus fotos de {{shoot}}:\n{{link}}\n\nGracias,\nMartin",
};

export const EMAIL_SUBJECTS = {
  en: "Your photos",
  fr: "Vos photos",
  es: "Tus fotos",
};

const EMAIL_LABELS = {
  en: {
    eyebrow: "YOUR PHOTO SHOOT",
    heading: "Your photos are ready.",
    pendingHeading: "Your photo link is ready.",
    pendingNote:
      "The photos are still uploading and will appear in the folder shortly.",
    button: "View my photos",
    backup: "If the button does not open, use this link:",
    signature: "Photographer",
  },
  fr: {
    eyebrow: "VOTRE SHOOTING",
    heading: "Vos photos sont prêtes.",
    pendingHeading: "Le lien de vos photos est prêt.",
    pendingNote:
      "Les photos sont encore en cours d’envoi et apparaîtront bientôt dans le dossier.",
    button: "Voir mes photos",
    backup: "Si le bouton ne s’ouvre pas, utilisez ce lien :",
    signature: "Photographe",
  },
  es: {
    eyebrow: "TU SESIÓN DE FOTOS",
    heading: "Tus fotos están listas.",
    pendingHeading: "El enlace de tus fotos está listo.",
    pendingNote:
      "Las fotos todavía se están subiendo y aparecerán pronto en la carpeta.",
    button: "Ver mis fotos",
    backup: "Si el botón no se abre, usa este enlace:",
    signature: "Fotógrafo",
  },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function photoUrl(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new Error("The photo link is invalid.");
  }
  if (url.protocol !== "https:")
    throw new Error("The photo link must use HTTPS.");
  return url.toString();
}

export function renderDeliveryEmailHtml({
  language,
  shoot,
  text,
  link,
  uploading = false,
}) {
  const labels = EMAIL_LABELS[language] || EMAIL_LABELS.en;
  const heading = uploading ? labels.pendingHeading : labels.heading;
  const colors = EMAIL_COLORS;
  const safeLink = escapeHtml(link);
  const copy = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== link)
    .join("\n")
    .trim();
  const safeCopy = escapeHtml(copy)
    .split(safeLink)
    .join(
      `<a href="${safeLink}" style="color:${colors.green};text-decoration:underline;">${safeLink}</a>`,
    )
    .replaceAll("\n", "<br>");

  return `<!doctype html>
<html lang="${language}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${colors.background};color:${colors.ink};font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;color:${colors.background};max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(heading)} ${escapeHtml(shoot)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${colors.background};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:560px;background:${colors.surface};border:1px solid ${colors.border};border-radius:18px;overflow:hidden;">
<tr><td style="background:${colors.green};padding:28px 30px 25px;color:${colors.surface};">
<div style="font-family:Georgia,serif;font-size:30px;line-height:1;letter-spacing:1px;">Martin<span style="color:${colors.softGreen};">.</span></div>
<div style="margin-top:8px;font-size:10px;font-weight:bold;letter-spacing:3px;">PHOTOGRAPHY</div>
</td></tr>
<tr><td style="padding:34px 30px 30px;">
<div style="color:${colors.green};font-size:11px;font-weight:bold;letter-spacing:2px;">${escapeHtml(labels.eyebrow)}</div>
<h1 style="margin:12px 0 10px;color:${colors.ink};font-family:Georgia,serif;font-size:31px;line-height:1.2;font-weight:normal;">${escapeHtml(heading)}</h1>
<div style="color:${colors.muted};font-size:14px;line-height:1.5;">${escapeHtml(shoot)}</div>
<div style="height:1px;background:${colors.border};margin:24px 0;"></div>
<div style="color:${colors.ink};font-size:16px;line-height:1.7;">${safeCopy}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 24px;"><tr><td bgcolor="${colors.green}" style="border-radius:999px;text-align:center;"><a href="${safeLink}" style="display:inline-block;padding:16px 28px;color:${colors.surface};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;">${escapeHtml(labels.button)} &nbsp;→</a></td></tr></table>
<div style="color:${colors.muted};font-size:12px;line-height:1.6;">${escapeHtml(labels.backup)}<br><a href="${safeLink}" style="color:${colors.green};text-decoration:underline;word-break:break-all;">${safeLink}</a></div>
</td></tr>
<tr><td style="background:${colors.softGreen};padding:23px 30px;border-top:1px solid ${colors.border};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="color:${colors.ink};font-size:13px;line-height:1.5;"><strong style="font-family:Georgia,serif;font-size:18px;font-weight:normal;">Martin</strong><br>${escapeHtml(labels.signature)}</td><td align="right" style="font-size:13px;"><a href="${INSTAGRAM_URL}" style="color:${colors.green};font-weight:bold;text-decoration:none;">@${INSTAGRAM_HANDLE}</a><br><span style="color:${colors.muted};font-size:11px;">Instagram</span></td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function formatEmailMessage(template, { name, shoot, link }) {
  const message = template
    .replaceAll("{{name}}", name)
    .replaceAll("{{shoot}}", shoot)
    .replaceAll("{{link}}", link);
  return template.includes("{{link}}") ? message : `${message}\n\n${link}`;
}

export function deliveryEmail(settings, shoot, link) {
  const language = EMAIL_MESSAGES[shoot.lang] ? shoot.lang : "en";
  const safeLink = photoUrl(link);
  const template =
    settings.emailMessages?.[language] ?? EMAIL_MESSAGES[language];
  const message = formatEmailMessage(template, {
    name: shoot.name,
    shoot: shoot.shootName || shoot.name,
    link: safeLink,
  });
  const uploading = ["creating", "sharing", "uploading"].includes(
    shoot.uploadStatus,
  );
  const deliveryMessage = uploading
    ? `${message}\n\n${EMAIL_LABELS[language].pendingNote}`
    : message;
  const instagramSuffix = deliveryMessage.includes(INSTAGRAM_HANDLE)
    ? ""
    : `\n\nInstagram: ${INSTAGRAM_URL}`;
  return {
    subject: `${EMAIL_SUBJECTS[language]} – ${shoot.shootName || shoot.name}`,
    text: `${deliveryMessage}${instagramSuffix}`,
    html: renderDeliveryEmailHtml({
      language,
      shoot: shoot.shootName || shoot.name,
      text: deliveryMessage,
      link: safeLink,
      uploading,
    }),
  };
}
import {
  EMAIL_COLORS,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from "../data/brand.js";
