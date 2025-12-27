import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/app/generated/prisma/enums";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const user = await getAuthUser();
    const requestId = params.id;
    const body = await req.json();

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json(
        { message: "Maintenance request not found" },
        { status: 404 }
      );
    }

    // ❌ EMPLOYEE has no access
    if (user.role === Role.EMPLOYEE) {
      return NextResponse.json(
        { message: "Employees cannot assign requests" },
        { status: 403 }
      );
    }

    const updateData: any = {};

    /* ================= TECHNICIAN ================= */
    if (user.role === Role.TECHNICIAN) {
      // Cannot override another technician's assignment
      if (request.assignedToId && request.assignedToId !== user.id) {
        return NextResponse.json(
          { message: "Request already assigned to another technician" },
          { status: 403 }
        );
      }

      // Technician can ONLY self-assign
      if (body.assignToSelf === true) {
        updateData.assignedToId = user.id;
        updateData.status = "ASSIGNED";
      } else {
        return NextResponse.json(
          { message: "Technician can only assign themselves" },
          { status: 403 }
        );
      }
    }

    /* ================= ADMIN ================= */
    if (user.role === Role.ADMIN) {
      if (body.teamId) {
        updateData.teamId = body.teamId;
      }

      if (body.assignedToId) {
        updateData.assignedToId = body.assignedToId;
        updateData.status = "ASSIGNED";
      }
    }

    const updatedRequest = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("ASSIGN_ROUTE_ERROR:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};
