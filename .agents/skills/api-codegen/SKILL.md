---
name: api-codegen
description: Use this skill when generating TypeScript types, API client interfaces, messaging protocol contracts, data models, or validating schema payloads.
---

# API & Schema Code Generation Skill

This skill provides guidelines and templates for generating type-safe API interfaces, message passing contracts, and schema definitions.

---

## 1. Type Design Principles

### Principle 1: Discriminated Unions for Message Protocols

When communicating across Chrome Extension boundaries (Background Service Worker, Sidepanel, Content Script, Popups), use discriminated unions for robust type safety:

```typescript
export type ExtensionMessage =
    | { type: 'REQUEST_INFERENCE'; payload: { prompt: string; modelId: string } }
    | { type: 'CANCEL_INFERENCE'; payload: { requestId: string } }
    | { type: 'STORAGE_SYNC'; payload: { key: string; value: unknown } }
    | { type: 'GET_ACTIVE_TAB'; payload?: never };

export type MessageResponse<T extends ExtensionMessage['type']> = T extends 'REQUEST_INFERENCE'
    ? { success: boolean; data?: string; error?: string }
    : T extends 'STORAGE_SYNC'
      ? { synced: boolean }
      : T extends 'GET_ACTIVE_TAB'
        ? { tabId: number; url: string }
        : { success: boolean };
```

### Principle 2: Strict Nullability and Readonly Properties

- Use `readonly` for immutable state and payload objects.
- Prefer explicit optional properties `field?: Type` or `field: Type | null` over `any`.

---

## 2. API Client & Handler Generation Template

### Type-Safe Message Sender Template

```typescript
export async function sendExtensionMessage<T extends ExtensionMessage>(
    message: T
): Promise<MessageResponse<T['type']>> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}
```

### Type-Safe Message Handler Template

```typescript
export function registerMessageListener(handlers: {
    [K in ExtensionMessage['type']]: (
        payload: Extract<ExtensionMessage, { type: K }>['payload'],
        sender: chrome.runtime.MessageSender
    ) => Promise<MessageResponse<K>> | MessageResponse<K>;
}) {
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
        const handler = handlers[message.type];
        if (handler) {
            Promise.resolve(handler(message.payload as any, sender))
                .then(sendResponse)
                .catch((err) => sendResponse({ success: false, error: err.message } as any));
            return true; // Keep channel open for async response
        }
        return false;
    });
}
```

---

## 3. Schema & Model Validation Checklist

- [ ] Are all fields typed explicitly without fallback to `any`?
- [ ] Are error shapes standardized across endpoints/actions?
- [ ] Are asynchronous responses properly typed with `Promise<T>`?
- [ ] Does `npm exec tsc -- --noEmit` pass with zero diagnostic errors?
