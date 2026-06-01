import { createServerApiClient } from "@/lib/api-client";
import { JobsTable } from "./jobs-table";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await createServerApiClient().get<React.ComponentProps<typeof JobsTable>["jobs"]>("/post-jobs/table");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
          <p className="text-gray-500 text-sm">No jobs yet.</p>
        </div>
      ) : (
        <JobsTable jobs={jobs} />
      )}
    </div>
  );
}
