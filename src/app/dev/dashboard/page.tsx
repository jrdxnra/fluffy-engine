import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Dev Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DevDashboardPage() {
  if (process.env.ENABLE_DEV_DASHBOARD !== "true") {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Dev Dashboard</h1>
      <p className="text-muted-foreground">
        This route is isolated for dashboard migration work and is intentionally hidden from production navigation.
      </p>
    </main>
  );
}
