import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import GoogleProvider from "next-auth/providers/google";
import { randomBytes } from "crypto";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "text",
          placeholder: "Enter your email",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Enter your password",
        },
      },
      authorize: async (credentials: any) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials?.email },
          });

          if (!user || !user.password) {
            throw new Error("Incorrect email or password");
          }

          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordCorrect) {
            throw new Error("Incorrect email or password");
          }

          return {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarURL: user.avatarURL,
            role: user.role,
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            throw new Error(error.message);
          }
          throw new Error("Unknown error occurred during authorization.");
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) {
          throw new Error(
            "No email associated with this Google account. Please make your email public or use another sign-in method."
          );
        }
        const existingUser = await prisma.user.findUnique({
          where: {
            email: user.email,
          },
        });

        if (!existingUser) {
          const fullName = user.name ?? "";
          const [firstName, ...rest] = fullName.split(" ");
          const lastName = rest.join(" ") || "User";

          const baseUsername =
            fullName.replace(/\s+/g, "").toLowerCase() ||
            user.email.split("@")[0];

          let username = baseUsername;
          let count = 1;

          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${count++}`;
          }

          const randomPassword = randomBytes(16).toString("hex");
          await prisma.user.create({
            data: {
              username,
              email: user.email,
              firstName: firstName || "User",
              lastName,
              role: "USER",
              avatarURL: user?.image ?? null,
              password: randomPassword,
            },
          });
        } else {
          if (user.image && existingUser.avatarURL !== user.image) {
            await prisma.user.update({
              where: {
                email: user.email,
              },
              data: {
                avatarURL: user.image,
              },
            });
          }
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.email = user.email;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.role = (user as any).role;
        token.avatarURL = (user as any).avatarURL;
      }

      if (!token.username && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: {
            email: token.email as string,
          },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username;
          token.email = dbUser.email;
          token.firstName = dbUser.firstName;
          token.lastName = dbUser.lastName;
          token.role = dbUser.role;
          token.avatarURL = dbUser.avatarURL;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username =
          token.username as string;
        (session.user as { email?: string }).email = token.email as string;
        (session.user as { firstName?: string }).firstName =
          token.firstName as string;
        (session.user as { lastName?: string }).lastName =
          token.lastName as string;
        (session.user as { avatarURL?: string }).avatarURL =
          token.avatarURL as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
};
