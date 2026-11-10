function previousAttempts(shoot) {
  return Array.isArray(shoot.emailHistory) ? shoot.emailHistory : [];
}

export function acceptedEmailPatch(shoot, recipient, gmailId, source) {
  const at = Date.now();
  return {
    emailStatus: "sent",
    emailId: gmailId,
    emailSentAt: at,
    emailError: "",
    emailHistory: [
      ...previousAttempts(shoot),
      { status: "sent", at, recipient, gmailId, source },
    ],
  };
}

export function failedEmailPatch(shoot, recipient, error, source) {
  const at = Date.now();
  return {
    emailStatus: "failed",
    emailError: error,
    emailHistory: [
      ...previousAttempts(shoot),
      { status: "failed", at, recipient, error, source },
    ],
  };
}
