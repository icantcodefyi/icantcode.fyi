import { auth } from "@my-better-t-app/auth";

async function handler(request: Request) {
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
