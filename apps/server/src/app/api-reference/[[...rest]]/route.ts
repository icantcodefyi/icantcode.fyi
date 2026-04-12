import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handler(request: Request) {
  const context = await createContext({ headers: request.headers });

  const result = await apiHandler.handle(request, {
    prefix: "/api-reference",
    context,
  });

  if (result.matched) {
    return result.response;
  }

  return new Response("Not found", { status: 404 });
}

export const GET = handler;
export const POST = handler;
