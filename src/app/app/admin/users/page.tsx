import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
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
import { toggleUserDisabledAction, changeUserRoleAction } from "./actions";
import { CreateUserForm } from "./create-user-form";

export default async function AdminUsersPage(): Promise<React.ReactElement> {
  const session = await requireAdmin();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabledAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">User Management</h1>

      <CreateUserForm />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === session.userId;
              const isDisabled = user.disabledAt !== null;

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isDisabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[hsl(var(--muted-foreground))]">
                    {user.lastLoginAt
                      ? user.lastLoginAt.toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-[hsl(var(--muted-foreground))]">
                    {user.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {isSelf ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        (you)
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <form action={toggleUserDisabledAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <Button variant="outline" size="sm" type="submit">
                            {isDisabled ? "Enable" : "Disable"}
                          </Button>
                        </form>
                        <form action={changeUserRoleAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <Button variant="outline" size="sm" type="submit">
                            {user.role === "ADMIN" ? "Demote" : "Promote"}
                          </Button>
                        </form>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
