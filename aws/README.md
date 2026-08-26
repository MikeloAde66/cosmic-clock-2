# Kali quantum task pipeline

Human-in-the-loop pipeline for submitting real Amazon Braket quantum
hardware (QPU) tasks, gated behind explicit approval — distinct from
Kali's existing `run_quantum_circuit` chat tool (see
`app/api/ai-one-chat/route.ts`), which only ever runs Braket's free
**LocalSimulator** and never touches real hardware or real cost.

**This pipeline's last stage spends real money the moment it runs** — a
physical QPU task, not a local simulation. Every stage before it exists
specifically to gate that one call behind a human decision.

## Pieces

- `step-functions/kali-quantum-workflow.json` — the state machine:
  validate on a simulator → publish to SNS and pause
  (`waitForTaskToken`) → submit to a real Braket device only once
  approved.
- `../app/api/kali/approve-task/route.ts` — admin-gated Next.js route
  that receives a decision and calls `SendTaskSuccess`/`SendTaskFailure`
  against the paused execution's task token.
- `setup-kali-quantum-infra.sh` — the AWS CLI commands to actually create
  the SNS topic, IAM execution role, and state machine. **Not run against
  the real account from this repo's dev environment** — there's no AWS
  CLI or credentials there. Run it yourself from a shell already
  authenticated as account `060274391988` (region `us-east-2`).

## Before running the setup script

1. Open `step-functions/kali-quantum-workflow.json` and replace:
   - `REPLACE_WITH_YOUR_KALI_VALIDATION_SERVICE_ENDPOINT` — the real,
     reachable URL of the existing external circuit-validation service
     (the same Python/Braket microservice `app/api/ai-one-chat/route.ts`
     already calls out to, since Vercel's Node runtime can't run
     Braket's SDK directly). **That service needs to return
     `qubitCount`, `estimatedCostUsd`, and `circuitSummary` in its
     response** for the approval notification to have real numbers in
     it — it isn't part of this repo, so those fields (if missing)
     need to be added there separately.
   - `REPLACE_WITH_YOUR_BRAKET_RESULTS_BUCKET` — a real S3 bucket you
     own in the same account/region, for Braket to write task results
     to.
2. Decide who should actually receive approval requests, and subscribe
   them to the SNS topic (the setup script prints the exact command
   once the topic exists).

## After running the setup script

Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in
this app's deployment environment, for an IAM identity with
`states:SendTaskSuccess` / `states:SendTaskFailure` permission on the
deployed state machine's ARN — that's what
`app/api/kali/approve-task/route.ts` uses to unblock a paused execution.

## What this does *not* include

- A dashboard UI for reviewing/approving pending tasks — the approval
  route exists, but nothing in this app's UI calls it yet. Wiring an
  admin-facing approval screen to it is a separate piece of work.
- The circuit-validation microservice itself, or adding the
  `estimatedCostUsd`/`qubitCount`/`circuitSummary` fields to its
  response — that service lives outside this repo.
- Actually creating the SNS topic, IAM role, or state machine in the
  real AWS account — see `setup-kali-quantum-infra.sh` above.
