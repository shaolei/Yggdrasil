# Orchestrator Responsibility

Parent module for recipe execution coordination. Contains the scheduler (lifecycle management, equipment booking, contamination cascades) and the phase engine (individual phase execution, timing, completion monitoring). Together they implement the recipe execution flow while delegating resource management to inventory and environmental data to the condition monitor.
