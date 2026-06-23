import { revalidatePath } from "next/cache";
import {
  deleteHistoricalRecordById,
  updateHistoricalRecordById,
  updateHistoricalRecordReviewStateById,
} from "@/lib/data";

const calculate1RM = (weight: number, reps: number): number => {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : "";

    if (!recordId) {
      return Response.json({ success: false, message: "recordId is required." }, { status: 400 });
    }

    await deleteHistoricalRecordById(recordId);

    revalidatePath("/admin/analytics");

    return Response.json({ success: true, message: "Historical record removed.", recordId });
  } catch (error) {
    console.error("Error fixing historical record:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fix historical record.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const reviewedIssue = typeof body?.reviewedIssue === "boolean" ? body.reviewedIssue : null;
    const weight = Number(body?.weight);
    const reps = Number(body?.reps);
    const date = typeof body?.date === "string" ? body.date.trim() : "";

    if (recordId && reviewedIssue !== null && !date && Number.isNaN(weight) && Number.isNaN(reps)) {
      await updateHistoricalRecordReviewStateById(recordId, reviewedIssue);
      revalidatePath("/admin/analytics");

      return Response.json({
        success: true,
        message: reviewedIssue ? "Historical record marked reviewed." : "Historical record review cleared.",
        record: {
          id: recordId,
          reviewedIssue,
          reviewedAt: reviewedIssue ? new Date().toISOString() : null,
        },
      });
    }

    if (!recordId || !date || Number.isNaN(weight) || Number.isNaN(reps)) {
      return Response.json(
        { success: false, message: "recordId, weight, reps, and date are required." },
        { status: 400 }
      );
    }

    if (weight <= 0 || reps <= 0) {
      return Response.json(
        { success: false, message: "weight and reps must be positive numbers." },
        { status: 400 }
      );
    }

    const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00.000Z` : new Date(date).toISOString();
    const estimated1RM = calculate1RM(weight, reps);

    await updateHistoricalRecordById(recordId, {
      date: isoDate,
      weight,
      reps,
      estimated1RM,
    });

    revalidatePath("/admin/analytics");

    return Response.json({
      success: true,
      message: "Historical record updated.",
      record: {
        id: recordId,
        date: isoDate,
        weight,
        reps,
        estimated1RM,
      },
    });
  } catch (error) {
    console.error("Error updating historical record:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update historical record.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : "";

    if (!recordId) {
      return Response.json({ success: false, message: "recordId is required." }, { status: 400 });
    }

    await deleteHistoricalRecordById(recordId);

    revalidatePath("/admin/analytics");

    return Response.json({ success: true, message: "Historical record removed.", recordId });
  } catch (error) {
    console.error("Error deleting historical record:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete historical record.",
      },
      { status: 500 }
    );
  }
}
