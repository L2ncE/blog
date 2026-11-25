export function onRequestGet({ request }) {
  const cf = request.cf || {};
  const body = JSON.stringify({
    colo: cf.colo || "EDGE",
    proto: cf.httpProtocol || "HTTP/2",
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
