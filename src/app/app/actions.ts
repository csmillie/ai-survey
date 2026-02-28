"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}
