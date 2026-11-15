# Following feed

The home page's **Following feed** includes projects from
followed creators and posts associated with joined communities.
Both sources use the existing `projects` table. Community posts
are identified by `projects.community_id`, which references
`communities.id` through `projects_community_id_fkey`.

The loader reads the signed-in user's existing `user_follows`
and `community_memberships` rows. It requests projects matching
either source, removes duplicate project IDs, and orders the
combined list by creation time descending, with project ID as a
stable tiebreaker. Users who have joined communities but follow
no creators still receive community posts. If a followed creator
posts in an unjoined community, that project remains eligible
through the existing creator-follow relationship.

Each community post displays its community name. The
relationship uses a left embed, so an otherwise readable
followed project remains visible if its community metadata is
unavailable; its label then reads **Community unavailable**.
Existing project cards, likes, collaboration actions, and
filters are reused. Beginner-friendly, experience, and
collaboration filters apply to both sources.

Loading and empty messages describe the combined feed. Query
failures show an error with **Try again**, rather than silently
presenting a partial feed or treating an error as an empty feed.
Navigating back to the home page reloads the user's current
follows and community memberships.

No new tables, membership system, following system, or post
creation flow are added. No database migration is required for
the supplied schema. The loader uses the normal Supabase client
and preserves existing Row Level Security and read permissions.

Verify locally with:

```sh
npm test --workspace=sidequest-frontend
npm run lint --workspace=sidequest-frontend
npm run build --workspace=sidequest-frontend
```

The following-feed tests use the real Supabase SDK with mocked
HTTP responses to check query scoping, joined-only and
creator-only users, empty feeds, overlap, ordering, community
labels, shared filters, and failures from either source.

For a live check, use a valid Supabase configuration and an
account with one followed creator and one joined community.
Ensure projects already exist both with and without a matching
`community_id`. Open `/feed` and confirm they appear together,
newest first, with no duplicate cards. Leave the community and
return to `/feed`: its posts should disappear unless their
author is still followed. Also verify a user who follows no
creators can see posts from a joined community.
