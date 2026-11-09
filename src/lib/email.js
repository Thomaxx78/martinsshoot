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

export function formatEmailMessage(template, { name, shoot, link }) {
  const message = template
    .replaceAll("{{name}}", name)
    .replaceAll("{{shoot}}", shoot)
    .replaceAll("{{link}}", link);
  return template.includes("{{link}}") ? message : `${message}\n\n${link}`;
}

export function deliveryEmail(settings, shoot, link) {
  const language = EMAIL_MESSAGES[shoot.lang] ? shoot.lang : "en";
  const template =
    settings.emailMessages?.[language] ?? EMAIL_MESSAGES[language];
  return {
    subject: `${EMAIL_SUBJECTS[language]} – ${shoot.shootName || shoot.name}`,
    text: formatEmailMessage(template, {
      name: shoot.name,
      shoot: shoot.shootName || shoot.name,
      link,
    }),
  };
}
