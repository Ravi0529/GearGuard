import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const proxy = async (req: NextRequest) => {
  const token = await getToken({ req: req });
  const url = req.nextUrl;

  if (
    token &&
    (url.pathname.startsWith("/signin") ||
      url.pathname.startsWith("/signup") ||
      url.pathname.startsWith("/"))
  ) {
    return NextResponse.redirect(new URL("/feed", req.url));
  }

  if (url.pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/signin"));
    }

    if (token && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/feed", req.url));
    }
  }

  if (!token && url.pathname.startsWith("/feed/")) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/signin", "/signup", "/", "/feed", "/feed/:path*"],
};
