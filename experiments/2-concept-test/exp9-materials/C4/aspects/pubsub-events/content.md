# PubSub Events

Every mutation to a team collection publishes a PubSub event so that connected clients (GraphQL subscriptions) receive real-time updates.

## Channel naming convention

- `team_coll/${teamID}/coll_added` — new collection created or imported
- `team_coll/${teamID}/coll_updated` — collection title or data changed
- `team_coll/${teamID}/coll_removed` — collection deleted (payload: collection ID, not full object)
- `team_coll/${teamID}/coll_moved` — collection moved to different parent
- `team_coll/${teamID}/coll_order_updated` — sibling order changed (payload includes moved collection + next collection)

## Timing

Events are published AFTER the database transaction commits successfully. This prevents phantom events where the client sees an update but the transaction rolled back. The exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds.

## Payload shape

- Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
- Removed: just the collection ID string
- Order updated: `{ collection, nextCollection }` pair
