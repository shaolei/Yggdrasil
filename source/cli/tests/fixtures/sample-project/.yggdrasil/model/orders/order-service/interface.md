# Order Service Interface

## Methods

### createOrder(items, customer)

Creates a new order from cart items. Validates inventory and applies pricing rules.

### cancelOrder(orderId)

Cancels an existing order. Triggers refund if payment was captured.

### getOrderStatus(orderId)

Returns current lifecycle status of an order.
