import { NextResponse, type NextRequest } from "next/server";

function getAllowedOrigins(): Set<string> {
  const raw = process.env.CORS_ORIGIN ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function middleware(request: NextRequest) {
  const allowedOrigins = getAllowedOrigins();
  const origin = request.headers.get("origin");
  const isAllowed = origin ? allowedOrigins.has(origin) : false;

  if (request.method === "OPTIONS") {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };
    if (isAllowed && origin) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();

  if (isAllowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
