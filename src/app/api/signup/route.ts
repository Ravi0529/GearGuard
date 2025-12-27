import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const POST = async (req: NextRequest) => {
  try {
    const { username, email, firstName, lastName, password } = await req.json();

    if (!username || !email || !firstName || !lastName || !password) {
      return NextResponse.json(
        {
          error: "All fields are required",
        },
        {
          status: 400,
        }
      );
    }

    const existingUsername = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUsername) {
      return NextResponse.json(
        {
          error: "Username already exists",
        },
        {
          status: 409,
        }
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          error: "Email already exists",
        },
        {
          status: 409,
        }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        firstName,
        lastName,
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      {
        user,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
};
