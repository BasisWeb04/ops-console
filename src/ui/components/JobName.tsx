import { getJob } from "../../sim/jobs";
import type { JobId } from "../../sim/types";

export function JobSwatch({ job }: { job: JobId }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: getJob(job).color }} />;
}

export function JobName({ job }: { job: JobId }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[13px]">
      <JobSwatch job={job} />
      {job}
    </span>
  );
}
