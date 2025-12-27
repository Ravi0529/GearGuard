import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

export async function getAuthUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!dbUser) {
    throw new Error("USER_NOT_FOUND");
  }

  return dbUser;
}
