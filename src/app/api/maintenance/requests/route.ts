import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role, MaintenanceFor } from "@/app/generated/prisma/enums";

export const POST = async (req: NextRequest) => {
  try {
    const user = await getAuthUser();

    // Only EMPLOYEE can create request
    if (user.role !== Role.EMPLOYEE) {
      return NextResponse.json(
        { message: "Only employees can create maintenance requests" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const {
      subject,
      description,
      maintenanceFor,
      maintenanceType,
      equipmentId,
      workCenterId,
      categoryId,
      priority,
    } = body;

    // Basic validation
    if (
      !subject ||
      !maintenanceFor ||
      !maintenanceType ||
      !categoryId ||
      !priority
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate maintenance target
    if (
      (maintenanceFor === MaintenanceFor.EQUIPMENT && !equipmentId) ||
      (maintenanceFor === MaintenanceFor.WORK_CENTER && !workCenterId)
    ) {
      return NextResponse.json(
        { message: "Invalid maintenance target" },
        { status: 400 }
      );
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        subject,
        description,
        maintenanceFor,
        maintenanceType,
        priority,
        categoryId,
        equipmentId: maintenanceFor === "EQUIPMENT" ? equipmentId : null,
        workCenterId: maintenanceFor === "WORK_CENTER" ? workCenterId : null,

        // System controlled fields
        createdById: user.id,
        status: "NEW",
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = async () => {
  try {
    const user = await getAuthUser();

    // EMPLOYEE → only own requests
    if (user.role === Role.EMPLOYEE) {
      const requests = await prisma.maintenanceRequest.findMany({
        where: { createdById: user.id },
        include: {
          equipment: true,
          workCenter: true,
          category: true,
          team: true,
          assignedTo: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(requests);
    }

    // TECHNICIAN → requests of their teams
    if (user.role === Role.TECHNICIAN) {
      const teamIds = await prisma.teamMember.findMany({
        where: { userId: user.id },
        select: { teamId: true },
      });

      const requests = await prisma.maintenanceRequest.findMany({
        where: {
          teamId: { in: teamIds.map((t) => t.teamId) },
        },
        include: {
          equipment: true,
          workCenter: true,
          category: true,
          team: true,
          assignedTo: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(requests);
    }

    // ADMIN → all requests
    if (user.role === Role.ADMIN) {
      const requests = await prisma.maintenanceRequest.findMany({
        include: {
          equipment: true,
          workCenter: true,
          category: true,
          team: true,
          assignedTo: true,
          createdBy: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(requests);
    }

    return NextResponse.json([], { status: 200 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};
