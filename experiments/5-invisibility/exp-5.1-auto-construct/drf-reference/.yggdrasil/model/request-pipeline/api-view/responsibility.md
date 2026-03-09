# APIView

APIView is the base class for all DRF views. It extends Django's `View` class and is responsible for:

- Orchestrating the full request lifecycle: initialize → authenticate → authorize → throttle → dispatch → finalize
- Providing the exception handling boundary that converts exceptions into structured API responses
- Defining the plugin point for all request processing policies via class attributes and `get_*()` factory methods
- CSRF exemption of all DRF views (applied in `as_view()`)
- Content negotiation (selecting renderer and media type)
- API versioning determination

## Not responsible for

- Implementing specific authentication, permission, or throttle logic (delegated to pluggable policy classes)
- Parsing request bodies (delegated to the Request object and parsers)
- Serializing response data (delegated to serializers and renderers)
- Defining concrete HTTP method handlers (that is the subclass's job)
