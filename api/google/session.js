import {
  clearSessionCookie,
  configured,
  cookieValue,
  noStore,
  publicSession,
  refreshAccess,
  unseal,
  verifyMartin,
} from "../../server/googleAuth.js";

export default async function handler(request, response) {
  noStore(response);
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed" });
  if (!configured())
    return response.status(200).json({ configured: false, connected: false });
  const refreshToken = unseal(cookieValue(request));
  if (!refreshToken)
    return response.status(200).json({ configured: true, connected: false });
  try {
    const token = await refreshAccess(refreshToken);
    const email = await verifyMartin(token.access_token);
    return response.status(200).json(publicSession(token, email));
  } catch {
    clearSessionCookie(response);
    return response.status(200).json({ configured: true, connected: false });
  }
}
