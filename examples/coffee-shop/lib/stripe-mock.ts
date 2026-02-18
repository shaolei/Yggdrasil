/**
 * Mock Stripe — simulates payment processing for demo.
 * Test card: 4242 4242 4242 4242
 */

export type MockPaymentIntent = {
  id: string;
  amount: number;
  status: "succeeded" | "failed";
};

export function createMockPaymentIntent(
  amount: number,
  _paymentMethodId?: string
): MockPaymentIntent {
  const id = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    amount,
    status: "succeeded",
  };
}

export function createMockPaymentIntentFail(
  amount: number
): MockPaymentIntent {
  return {
    id: `pi_mock_fail_${Date.now()}`,
    amount,
    status: "failed",
  };
}
