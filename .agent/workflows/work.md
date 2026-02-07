---
description: Strictly follow this workflow for all development, debugging, and feature implementation. Do not rely on assumptions. Every action must be verified through execution logs and observable behavior until the defined goal is confirmed.
---

Starting now, my workflow is:

Place Debug Logs at Every Step:
Before implementing complex logic or fixing a bug, always add debug or console logs at the beginning, important decision points, loops, external calls, and the end of relevant functions or blocks.

Use Logs as the Source of Truth:
Always rely on actual terminal or console output to verify execution flow and variable states. Never assume code works just by reading it. If logs contradict expectations, logs are correct.

Trace Until "Goal Print":
Define a clear confirmation log (Goal Print) for every task. Follow the logs step by step until the Goal Print appears, proving the intended action has successfully completed.

Validate Execution Flow:
Verify function order, branch execution, thread behavior, shared state, resource loading, and return values using logs. If something is unclear, add more logs until the flow is fully visible.

Prevent Silent Failures:
Log inputs, outputs, warnings, and exceptions. Never allow logic paths to fail silently. Unexpected states must always be printed and handled.

Build Progressively:
Make it run first, make it visible with logs, then make it correct, then optimize, and finally clean the code. Never optimize before behavior is verified.

Verify After Fixing:
After any change, rerun the full flow and confirm all Goal Prints appear. Remove only unnecessary logs, but keep structural logs for future debugging.

Maintain Debug Mindset:
Always think in terms of execution flow, state tracing, and verification. This mindset applies to all future debugging and feature implementation.
