import {
  configured,
  exchangeCode,
  hasRequiredScopes,
  noStore,
  publicSession,
  sameOrigin,
  setSessionCookie,
  verifyMartin,
} from "../../server/googleAuth.js";

export default async function handler(request, response) {
  noStore(response);
  if (request.method !== "POST")
    return response.status(405).json({ error: "Method not allowed" });
  if (
    !sameOrigin(request) ||
    request.headers["x-requested-with"] !== "XMLHttpRequest"
  )
    return response.status(403).json({ error: "Invalid request origin" });
  if (!configured())
    return response
      .status(503)
      .json({ error: "Google session not configured" });
  const code = request.body?.code;
  if (typeof code !== "string" || !code || code.length > 4096)
    return response.status(400).json({ error: "Missing Google code" });
  try {
    const token = await exchangeCode(code, request.headers.origin);
    if (!hasRequiredScopes(token.scope))
      return response
        .status(403)
        .json({ error: "Drive and Gmail permissions are required" });
    const email = await verifyMartin(token.access_token);
    if (!token.refresh_token)
      return response.status(409).json({
        error:
          "Google did not return a refresh token. Remove this app from your Google account permissions and reconnect.",
      });
    setSessionCookie(response, token.refresh_token);
    return response.status(200).json(publicSession(token, email));
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
}
