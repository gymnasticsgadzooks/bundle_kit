import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node";
import { handleRequest } from "@vercel/remix";
import { addDocumentResponseHeaders } from "./shopify.server";

export default async function entryServer(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const remixServer = (
    <RemixServer context={remixContext} url={request.url} />
  );
  return handleRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixServer
  );
}
