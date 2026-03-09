# Class-Based Configuration

All policy components follow a two-level configuration hierarchy:

1. **Global defaults** from `api_settings.DEFAULT_*_CLASSES` (set in Django settings)
2. **Per-view override** by setting the class attribute on the view class

Example: `APIView.authentication_classes = api_settings.DEFAULT_AUTHENTICATION_CLASSES` at class level. A specific view can override: `authentication_classes = [TokenAuthentication]`.

This applies to: authentication_classes, permission_classes, throttle_classes, renderer_classes, parser_classes, content_negotiation_class, metadata_class, versioning_class.

## Why

Allows project-wide defaults with per-endpoint customization. No runtime configuration required — everything is declarative at the class level.
