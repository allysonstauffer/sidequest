# Project Context: SideQuest

## Product

A social networking app for people to share hobbies, discover
projects, meet community members, and have fun pursuing their
side quests.

- Users can create profiles that show their interests and
  hobbies.
- Users can share hobby-related projects, posts, images, and
  updates.
- Users can discover communities and people with similar
  interests.
- Users can interact with and connect to other community
  members.

## Current stack

- Frontend: React 19 with TypeScript and Vite.
- Frontend tooling: ESLint and Prettier.
- Backend: Python, using the virtual environment created for the
  project.
- Repository structure: npm workspace monorepo under
  `packages/`.

## Constraints

- Do not include real personal information in GenAI prompts,
  examples, or test data.
- Keep the experience welcoming, inclusive, and centered on
  shared interests.
- Preserve user control over shared content and connections.
- Follow the existing project conventions in `CONTRIBUTING.md`.
- Do not invent privacy, moderation, or community policies
  without a team or stakeholder decision.

## AI collaboration context

9/18/2026 - Sprint 1

- Treat SideQuest as an Instagram-style social network for
  hobbies, focused on meeting community members, sharing
  projects, and having fun.
- Use the existing React, TypeScript, Vite, Python, npm
  workspace, ESLint, and Prettier setup. Do not introduce a
  different stack without a team decision.
- Follow `CONTRIBUTING.md`: use clear commits, the repository's
  formatting rules, PascalCase file names for React components,
  and camelCase function names.
- Keep changes focused and preserve existing public APIs and
  project structure unless the task requires otherwise.
- Before proposing a feature, separate confirmed requirements
  from assumptions and open questions. Ask the team about
  unresolved product, privacy, moderation, or data decisions.
- Validate frontend changes with
  `npm run lint --workspace=sidequest-frontend`,
  `npm run build --workspace=sidequest-frontend`, and Prettier
  checks when relevant.
- Keep `SRD - SideQuest.docx` as a valid Word document. Edit it
  with a document editor rather than treating it as plain text.
- Do not commit `node_modules`, build output, temporary backups,
  or personal information.

## Open questions

- Which hobbies, communities, and post types should the first
  release support?
- Should users follow one another, join communities, or use both
  connection models?
- Which interactions should be available on posts, such as
  likes, comments, saves, or shares?
- What profile and visibility settings should users control?
- What reporting, moderation, and safety features are required?
- Which backend framework and database should the Python backend
  use?

## Task prompt pattern

Using only the evidence and confirmed decisions above:

1. Draft one user story for a hobbyist or community member.
2. Draft Given / When / Then acceptance criteria.
3. List assumptions separately.
4. List questions that require a team or stakeholder decision.
5. Do not invent product policy, timing, moderation, or privacy
   requirements.
