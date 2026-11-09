import {
  clearSessionCookie,
  noStore,
  sameOrigin,
} from "../../server/googleAuth.js";

export default function handler(request, response) {
  noStore(response);
  if (request.method !== "POST")
    return response.status(405).json({ error: "Method not allowed" });
  if (
    !sameOrigin(request) ||
    request.headers["x-requested-with"] !== "XMLHttpRequest"
  )
    return response.status(403).json({ error: "Invalid request origin" });
  clearSessionCookie(response);
  return response.status(200).json({ connected: false });
}
