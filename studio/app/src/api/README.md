Owned by Worker 4: state, history, server and shortcuts (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

The typed client for the studio server. Import from `../api`:

- `api`: the client for this page's own server. `createClient({ baseUrl, fetch })` makes another (tests).
- `ApiError`: the one error every call throws. Its `message` is a plain sentence that can be shown as it is.
- `subscribeEvents`: live events with reconnection. `api.events(job, handlers)` is the usual way in.
