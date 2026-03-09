# DRF Request Pipeline — Responsibility

## Identity

The request pipeline is the core of Django REST Framework's view layer. It processes incoming HTTP requests through a configurable chain of policies (authentication, permissions, throttling) before dispatching to handler methods, and produces properly formatted responses.

## Boundaries

This module group covers the request processing pipeline only: views, request wrapping, authentication, permissions, and throttling. It does not cover serialization, routing, rendering, filtering, pagination, or other DRF subsystems.
