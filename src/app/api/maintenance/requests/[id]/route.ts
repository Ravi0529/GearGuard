import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/app/generated/prisma/enums";

export const GET = async (
  _req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const user = await getAuthUser();
    const requestId = params.id;

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: {
        equipment: true,
        workCenter: true,
        category: true,
        team: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!request) {
      return NextResponse.json(
        { message: "Request not found" },
        { status: 404 }
      );
    }

    // EMPLOYEE → only own request
    if (user.role === Role.EMPLOYEE && request.createdById !== user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // TECHNICIAN → must belong to assigned team
    if (user.role === Role.TECHNICIAN) {
      const isTeamMember = await prisma.teamMember.findFirst({
        where: {
          userId: user.id,
          teamId: request.teamId ?? undefined,
        },
      });

      if (!isTeamMember) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    // ADMIN → full access
    return NextResponse.json(request);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const user = await getAuthUser();
    const requestId = params.id;
    const body = await req.json();

    const existing = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Request not found" },
        { status: 404 }
      );
    }

    // EMPLOYEE → no updates
    if (user.role === Role.EMPLOYEE) {
      return NextResponse.json(
        { message: "Employees cannot update maintenance requests" },
        { status: 403 }
      );
    }

    const updateData: any = {};

    /* ================= TECHNICIAN ================= */
    if (user.role === Role.TECHNICIAN) {
      // Technician can only work on:
      // - unassigned requests
      // - or requests already assigned to them
      if (existing.assignedToId && existing.assignedToId !== user.id) {
        return NextResponse.json(
          { message: "This request is assigned to another technician" },
          { status: 403 }
        );
      }

      // Self-assign only
      if (body.assignToSelf === true) {
        updateData.assignedToId = user.id;
      }

      if (body.status) {
        updateData.status = body.status;
      }

      if (body.scheduledDate) {
        updateData.scheduledDate = new Date(body.scheduledDate);
      }

      if (body.durationHours) {
        updateData.durationHours = body.durationHours;
      }
    }

    /* ================= ADMIN ================= */
    if (user.role === Role.ADMIN) {
      if (body.teamId) updateData.teamId = body.teamId;
      if (body.assignedToId) updateData.assignedToId = body.assignedToId;
      if (body.status) updateData.status = body.status;
      if (body.scheduledDate)
        updateData.scheduledDate = new Date(body.scheduledDate);
      if (body.durationHours) updateData.durationHours = body.durationHours;
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};
