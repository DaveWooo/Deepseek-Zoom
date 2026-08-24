---
name: testing-and-qa
description: Use this skill when running tests, diagnosing test failures, executing type checking or linting, and ensuring code quality and test coverage across the project.
---

# Testing and QA Skill

This skill provides standard procedures and workflows for running tests, performing static code analysis, and debugging test failures.

---

## 1. Fast Command Reference

| Task                    | Command                                   | Description                                                                                             |
| :---------------------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **All-in-One QA Check** | `npm run check`                           | Runs prettier check, build, TypeScript typecheck (`tsc --noEmit`), Knip unused check, and Vitest suite. |
| **Run Unit Tests**      | `npm run test`                            | Runs the Vitest test suite once.                                                                        |
| **Run Specific Test**   | `npx vitest run test/<file>.test.ts`      | Runs a single test file.                                                                                |
| **Run Filtered Tests**  | `npx vitest run -t "<test-name-pattern>"` | Runs tests matching a specific name pattern.                                                            |
| **Type Check Only**     | `npm exec tsc -- --noEmit`                | Validates TypeScript types without building output.                                                     |
| **Format Check**        | `npm run format:check`                    | Checks Prettier formatting compliance.                                                                  |
| **Format Auto-fix**     | `npm run format`                          | Auto-formats code with Prettier.                                                                        |
| **Unused Code Check**   | `npm run lint:unused`                     | Runs Knip to identify unused exports and dependencies.                                                  |

---

## 2. Test Execution & Debugging Workflow

### Step 1: Pre-Execution Environment Check

- Ensure dependencies are installed and test environment matches Node.js / JSDOM requirements.
- Note: In browser extension projects, Chrome APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`) must be mocked in test files before running.

### Step 2: Running & Narrowing Down Tests

1. Run targeted tests first to isolate regressions:
    ```bash
    npx vitest run test/<target-file>.test.ts
    ```
2. If tests fail:
    - Examine the assertion output and stack trace.
    - Check if asynchronous operations (Promises, `async/await`, timers) were properly resolved or mocked.
    - For DOM-related tests, check if JSDOM elements were created and cleaned up between runs (`afterEach`).

### Step 3: Verifying the Entire QA Pipeline

Before finalizing any fix or feature, always execute the full validation command:

```bash
npm run check
```

Ensure all 5 stages pass:

1. `format:check` (Prettier)
2. `build` (Vite)
3. `tsc --noEmit` (TypeScript compiler)
4. `lint:unused` (Knip)
5. `test` (Vitest)

---

## 3. Best Practices for Writing New Tests

- **Location**: Place test files in `test/` or alongside source files with `.test.ts` / `.spec.ts` extensions.
- **Mocking**: Keep mocks minimal and explicit. Clean up state in `beforeEach` / `afterEach`.
- **Determinism**: Avoid hard-coded delays or non-deterministic timeouts; use mock timers (`vi.useFakeTimers()`) if needed.
