# Inline project checklists

Approved intent: show every pending task under its project, indent children, collapse completed tasks and settings, allow title+Enter capture directly, remove the redundant 내 활동 and 활동 관리 navigation.

Implementation boundary: presentation components only; existing shared task validation, local persistence, archive semantics, timer, and today calendar remain intact. No deployment, schema migration, or user data writes during testing.

Verification: isolated desktop/mobile browser contexts seed five pending roots plus a child and completed task; assert all pending items visible, completed hidden, direct capture and completion persist across reload. Run existing local workflow regression suite, TypeScript and production build.

Known limitation: changing a project's category while its inline input contains an unsaved draft remounts that card. Save the draft with Enter before moving categories. Persisted records are unaffected.
