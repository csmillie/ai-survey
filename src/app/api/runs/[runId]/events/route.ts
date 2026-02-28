import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { canAccessSurvey } from "@/lib/survey-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunStatusEvent {
  runId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  progress: number;
}

// ---------------------------------------------------------------------------
// SSE Endpoint
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const { runId } = await params;

  // 1. Authenticate from session cookie
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session = await verifySession(sessionCookie.value);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Load run and verify access
  const run = await prisma.surveyRun.findUnique({
    where: { id: runId },
    select: { id: true, surveyId: true, status: true },
  });

  if (!run) {
    return new Response("Not found", { status: 404 });
  }

  const hasAccess = await canAccessSurvey(session.userId, run.surveyId, "VIEW");
  if (!hasAccess) {
    return new Response("Forbidden", { status: 403 });
  }

  // 3. Create SSE stream
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: RunStatusEvent): void => {
        if (cancelled) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          cancelled = true;
        }
      };

      const poll = async (): Promise<void> => {
        while (!cancelled) {
          try {
            // Query current run status
            const currentRun = await prisma.surveyRun.findUnique({
              where: { id: runId },
              select: { status: true },
            });

            if (!currentRun) {
              cancelled = true;
              break;
            }

            // Count jobs by status
            const [total, completed, failed, running] = await Promise.all([
              prisma.job.count({
                where: { runId, type: "EXECUTE_QUESTION" },
              }),
              prisma.job.count({
                where: { runId, type: "EXECUTE_QUESTION", status: "SUCCEEDED" },
              }),
              prisma.job.count({
                where: { runId, type: "EXECUTE_QUESTION", status: "FAILED" },
              }),
              prisma.job.count({
                where: { runId, type: "EXECUTE_QUESTION", status: "RUNNING" },
              }),
            ]);

            const progress = total > 0 ? (completed + failed) / total : 0;

            const event: RunStatusEvent = {
              runId,
              status: currentRun.status,
              total,
              completed,
              failed,
              running,
              progress,
            };

            sendEvent(event);

            // If terminal, send final event and close
            if (TERMINAL_STATUSES.has(currentRun.status)) {
              try {
                controller.close();
              } catch {
                // Already closed
              }
              return;
            }
          } catch (err) {
            console.error(`[SSE] Error polling run ${runId}:`, err);
            cancelled = true;
            try {
              controller.close();
            } catch {
              // Already closed
            }
            return;
          }

          // Wait before next poll
          await new Promise<void>((resolve) =>
            setTimeout(resolve, POLL_INTERVAL_MS)
          );
        }

        // Stream cancelled by client
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      void poll();
    },

    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
