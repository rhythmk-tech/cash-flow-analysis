import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { IDLE_TIMEOUT_SECONDS } from "@/lib/session-config";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Sessions expire after IDLE_TIMEOUT_SECONDS of inactivity — updateAge keeps the cookie's
  // expiry sliding forward on active use, but stop making requests for that long and the
  // session cookie itself expires, so a request after that is simply unauthenticated.
  // IdleLogout.tsx enforces the same window client-side for an immediate redirect instead of
  // waiting on the next request to fail.
  session: { strategy: "jwt", maxAge: IDLE_TIMEOUT_SECONDS, updateAge: 5 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const rateLimitKey = `login:${clientIp(request)}:${email}`;
        if (!checkRateLimit(rateLimitKey, LOGIN_LIMIT, LOGIN_WINDOW_MS).allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.companyName };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
});
