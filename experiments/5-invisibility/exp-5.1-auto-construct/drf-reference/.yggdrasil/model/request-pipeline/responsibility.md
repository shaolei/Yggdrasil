# Request Processing Pipeline

The request processing pipeline is the core of Django REST Framework's view layer. It is responsible for:

- Wrapping Django's `HttpRequest` into a richer `Request` object with lazy authentication and content parsing
- Orchestrating the pre-handler check sequence: authentication, permission checking, and throttle enforcement
- Dispatching to the appropriate HTTP method handler
- Handling exceptions and producing structured error responses
- Finalizing responses with content negotiation and headers

## Not responsible for

- Serialization/deserialization of domain objects (that is the serializer layer)
- URL routing (that is Django's URL dispatcher and DRF's routers)
- Response rendering (that is the renderer layer; the pipeline only selects the renderer)
- Database queries or domain logic (that belongs to the view handler or viewset)
