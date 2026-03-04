model/
├── admin/ [module] aspects:pubsub-events -> 0 relations
│   └── admin-service/ [service] aspects:pubsub-events,role-based-access -> 6 relations
├── auth/ [module] -> 0 relations
│   └── auth-service/ [service] -> 1 relations
├── team/ [module] aspects:pubsub-events -> 0 relations
│   └── team-service/ [service] aspects:pubsub-events,role-based-access -> 1 relations
├── team-collections/ [module] aspects:pessimistic-locking,pubsub-events -> 0 relations
│   └── team-collection-service/ [service] aspects:pessimistic-locking,pubsub-events,retry-on-deadlock,team-ownership -> 1 relations
├── team-environments/ [module] aspects:pubsub-events -> 0 relations
│   └── team-environments-service/ [service] aspects:pubsub-events,team-ownership -> 1 relations
├── team-invitation/ [module] aspects:pubsub-events -> 0 relations
│   └── team-invitation-service/ [service] aspects:pubsub-events,role-based-access,team-ownership -> 2 relations
├── team-request/ [module] aspects:pessimistic-locking,pubsub-events -> 0 relations
│   └── team-request-service/ [service] aspects:pessimistic-locking,pubsub-events,team-ownership -> 2 relations
└── user/ [module] aspects:pubsub-events -> 0 relations
    └── user-service/ [service] aspects:pubsub-events -> 0 relations
