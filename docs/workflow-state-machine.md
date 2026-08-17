# Workflow state machine

```text
DISCOVERED -> GENERATING -> PENDING_REVIEW -> APPROVED -> QUEUED -> SCHEDULED -> PUBLISHED
                                  |                |
                                  v                v
                              REVISION          REJECTED

Any automated stage -> FAILED -> retry (DISCOVERED, GENERATING, or QUEUED)
```

Transitions are centralized in `src/workflow/state.ts`; callers must use `assertTransition` rather than assigning arbitrary strings.
