# Categories Page

UI for viewing and managing expense categories.

## Responsible for

- Displaying system + custom categories
- Custom category creation form with limit counter (x/5 for free plan)
- Deleting custom categories (system categories show no delete option)
- Handling 403 CATEGORY_LIMIT errors

## Not responsible for

- System category seeding (handled by api/db)
- Category editing (not exposed in the web UI — only name can be set at creation)
