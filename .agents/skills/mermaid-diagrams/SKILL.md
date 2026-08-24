---
name: mermaid-diagrams
description: Use this skill when creating or updating Mermaid diagrams, architecture flowcharts, sequence diagrams, state machines, or ER diagrams.
---

# Mermaid Diagrams Skill

This skill provides syntax rules, formatting standards, and templates for rendering bug-free Mermaid diagrams.

---

## 1. Syntax Guardrails & Common Pitfalls

To ensure diagrams render reliably without parser errors:

1. **Quote Node Labels with Special Characters**:
    - Always wrap node labels containing parentheses `()`, brackets `[]`, colons `:`, slashes `/`, or spaces in double quotes.
    - **Correct**: `A["Service Worker (Background)"] --> B["Content Script"]`
    - **Incorrect**: `A[Service Worker (Background)] --> B[Content Script]`
2. **Avoid Raw HTML Tags in Labels**:
    - Do not include `<b>`, `<span>`, `<br/>` unless strictly supported and tested. Use markdown-compatible plain text.
3. **Use Standard Layout Orientations**:
    - `TD` or `TB`: Top-to-bottom (ideal for hierarchal architecture or decision trees).
    - `LR`: Left-to-right (ideal for pipelines, lifecycle stages, and sequential data flows).

---

## 2. Common Diagram Templates

### Architecture & Data Flow (Flowchart TD/LR)

```mermaid
graph TD
    subgraph UI ["User Interface (Sidepanel / Popup)"]
        A["User Input Component"] --> B["State Store"]
        B --> C["View Renderer"]
    end

    subgraph Core ["Background Engine"]
        D["Message Router"]
        E["Storage Manager"]
        F["API Client"]
    end

    C -- "chrome.runtime.sendMessage" --> D
    D --> E
    D --> F
```

### Async Message Sequence (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Sidepanel UI
    participant BG as Background Worker
    participant API as Remote AI Endpoint

    UI->>BG: SEND_QUERY { prompt: "..." }
    activate BG
    BG->>API: HTTP POST /v1/chat/completions
    activate API
    API-->>BG: Streaming Chunks / Response
    deactivate API
    BG-->>UI: MSG_RESPONSE { data: "..." }
    deactivate BG
```

### State Machine (State Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Connecting : User triggers action
    Connecting --> Streaming : Connection established
    Connecting --> Error : Timeout / Network Failure
    Streaming --> Completed : Stream finished
    Streaming --> Error : Aborted by user / Server error
    Error --> Idle : Reset
    Completed --> Idle : Clear session
```

---

## 3. Review Checklist

- [ ] Are all complex strings enclosed in `"quotes"` inside node brackets?
- [ ] Is diagram direction (`TD`, `LR`) appropriate for readability?
- [ ] Are subgraph names and identifiers clean without spaces in IDs (use IDs with quotes: `subgraph ID ["Label"]`)?
