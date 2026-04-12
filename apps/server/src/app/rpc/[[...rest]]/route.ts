import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handler(request: Request) {
  const context = await createContext({ headers: request.headers });

  const result = await rpcHandler.handle(request, {
    prefix: "/rpc",
    context,
  });

  if (result.matched) {
    return result.response;
  }

  return new Response("Not found", { status: 404 });
}

export const GET = handler;
export const POST = handler;
