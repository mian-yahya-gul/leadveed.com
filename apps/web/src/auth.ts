import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { LeadVeedAdapter } from "@/lib/auth-adapter";

const adapter = LeadVeedAdapter();
const providers: any[] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_RESEND_KEY) {
  providers.push(Resend({ from: process.env.AUTH_EMAIL_FROM ?? "LeadVeed <login@leadveed.com>" }));
}

// Local testing only: sign in with any email, no password. Only works when the site URL is
// localhost, so it can never switch on for leadveed.com even if the variable is set by mistake.
export const devLogin = process.env.AUTH_DEV_LOGIN === "1"
  && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");
if (devLogin) {
  providers.push(Credentials({
    id: "dev", name: "Dev login",
    credentials: { email: { label: "Email", type: "email" } },
    async authorize(c) {
      const email = String(c?.email ?? "").toLowerCase();
      if (!email.includes("@")) return null;
      return (await adapter.getUserByEmail!(email)) ?? (await adapter.createUser!({ id: "", email, emailVerified: null } as any));
    },
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", verifyRequest: "/login?sent=1" },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
});

export const enabledProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID),
  email: Boolean(process.env.AUTH_RESEND_KEY),
};
