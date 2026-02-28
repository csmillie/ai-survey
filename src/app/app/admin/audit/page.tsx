import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

interface AuditPageProps {
  searchParams: Promise<{ page?: string; action?: string }>;
}

export default async function AdminAuditPage({
  searchParams,
}: AuditPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const actionFilter = params.action || undefined;

  const where = actionFilter ? { action: actionFilter } : {};

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildUrl(p: number, action?: string): string {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (action) params.set("action", action);
    const qs = params.toString();
    return `/app/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        {actionFilter && (
          <Link href="/app/admin/audit">
            <Button variant="outline" size="sm">
              Clear Filter
            </Button>
          </Link>
        )}
      </div>

      {actionFilter && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Filtering by action: <Badge variant="secondary">{actionFilter}</Badge>
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target Type</TableHead>
              <TableHead>Target ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-[hsl(var(--muted-foreground))]"
                >
                  No audit events found.
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {event.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell>{event.actor.email}</TableCell>
                  <TableCell>
                    <Link href={buildUrl(1, event.action)}>
                      <Badge variant="outline" className="cursor-pointer">
                        {event.action}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell>{event.targetType}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">
                    {event.targetId}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Page {page} of {totalPages} ({total} events)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl(page - 1, actionFilter)}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl(page + 1, actionFilter)}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
