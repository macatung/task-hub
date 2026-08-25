<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Workspace;
use App\Models\WorkspaceSubscription;
use App\Services\WorkspaceContext;
use App\Services\WorkspaceQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiSubscriptionController extends Controller
{
    /**
     * Get current subscription and usage metrics for a workspace.
     */
    public function show(
        Request $request,
        Workspace $workspace,
        WorkspaceContext $context,
        WorkspaceQuotaService $quotaService
    ): JsonResponse {
        $context->authorizeRole($request, ['owner', 'admin', 'developer', 'viewer']);

        $subscription = $workspace->activeSubscription();
        $plan = $workspace->activePlan();

        $subData = [
            'id' => $subscription?->id,
            'plan_slug' => $plan->slug,
            'plan_name' => $plan->name,
            'billing_cycle' => $subscription?->billing_cycle ?? 'monthly',
            'status' => $subscription?->status ?? 'active',
            'seat_quantity' => $subscription?->seat_quantity ?? ($plan->max_seats ?? 1),
            'extra_runners_quantity' => $subscription?->extra_runners_quantity ?? 0,
            'current_period_starts_at' => $subscription?->current_period_starts_at?->toIso8601String() ?? now()->toIso8601String(),
            'current_period_ends_at' => $subscription?->current_period_ends_at?->toIso8601String() ?? now()->addMonth()->toIso8601String(),
            'canceled_at' => $subscription?->canceled_at?->toIso8601String(),
        ];

        $usage = $quotaService->getUsageSummary($workspace);
        $invoices = $workspace->invoices()->latest()->take(10)->get();

        return response()->json([
            'success' => true,
            'data' => [
                'subscription' => $subData,
                'usage' => $usage,
                'invoices' => $invoices,
            ],
        ]);
    }

    /**
     * Update or upgrade a workspace subscription.
     */
    public function update(
        Request $request,
        Workspace $workspace,
        WorkspaceContext $context,
        WorkspaceQuotaService $quotaService
    ): JsonResponse {
        $context->authorizeRole($request, ['owner', 'admin']);

        $validated = $request->validate([
            'plan_slug' => 'required|string|exists:plans,slug',
            'billing_cycle' => 'nullable|string|in:monthly,yearly',
            'seat_quantity' => 'nullable|integer|min:1|max:500',
            'extra_runners_quantity' => 'nullable|integer|min:0|max:100',
        ]);

        $plan = Plan::where('slug', $validated['plan_slug'])->firstOrFail();
        $billingCycle = $validated['billing_cycle'] ?? 'monthly';
        $seatQuantity = $validated['seat_quantity'] ?? ($plan->max_seats ?? 1);
        $extraRunners = $validated['extra_runners_quantity'] ?? 0;

        // Calculate pricing
        $baseAmount = $plan->getPriceForCycle($billingCycle);
        $seatRate = $billingCycle === 'yearly' ? 96.00 : 10.00;
        $runnerRate = $billingCycle === 'yearly' ? 144.00 : 15.00;

        $includedSeats = $plan->max_seats ?? 1;
        $extraSeats = max(0, $seatQuantity - $includedSeats);

        $totalAmount = $baseAmount + ($extraSeats * $seatRate) + ($extraRunners * $runnerRate);

        $now = now();
        $endsAt = $billingCycle === 'yearly' ? $now->copy()->addYear() : $now->copy()->addMonth();

        $subscription = WorkspaceSubscription::updateOrCreate(
            ['workspace_id' => $workspace->id],
            [
                'plan_id' => $plan->id,
                'billing_cycle' => $billingCycle,
                'status' => 'active',
                'seat_quantity' => $seatQuantity,
                'extra_runners_quantity' => $extraRunners,
                'current_period_starts_at' => $now,
                'current_period_ends_at' => $endsAt,
                'canceled_at' => null,
                'payment_method' => 'simulation',
            ]
        );

        // Keep legacy workspace fields in sync
        $workspace->syncPlanAndLimits($plan, $extraRunners);

        // Generate paid invoice
        $invoice = Invoice::create([
            'invoice_number' => Invoice::generateInvoiceNumber(),
            'workspace_id' => $workspace->id,
            'subscription_id' => $subscription->id,
            'plan_name' => $plan->name,
            'billing_cycle' => $billingCycle,
            'amount' => $totalAmount,
            'currency' => $plan->currency,
            'status' => 'paid',
            'billing_reason' => 'subscription_update',
            'description' => "{$plan->name} Plan (" . ucfirst($billingCycle) . ")",
            'paid_at' => $now,
            'period_start' => $now,
            'period_end' => $endsAt,
        ]);

        $subData = [
            'id' => $subscription->id,
            'plan_slug' => $plan->slug,
            'plan_name' => $plan->name,
            'billing_cycle' => $subscription->billing_cycle,
            'status' => $subscription->status,
            'seat_quantity' => $subscription->seat_quantity,
            'extra_runners_quantity' => $subscription->extra_runners_quantity,
            'current_period_starts_at' => $subscription->current_period_starts_at?->toIso8601String(),
            'current_period_ends_at' => $subscription->current_period_ends_at?->toIso8601String(),
            'canceled_at' => $subscription->canceled_at?->toIso8601String(),
        ];

        return response()->json([
            'success' => true,
            'message' => 'Subscription updated successfully.',
            'data' => [
                'subscription' => $subData,
                'invoice' => $invoice,
                'usage' => $quotaService->getUsageSummary($workspace),
            ],
        ]);
    }

    /**
     * Cancel an active recurring subscription.
     */
    public function cancel(
        Request $request,
        Workspace $workspace,
        WorkspaceContext $context
    ): JsonResponse {
        $context->authorizeRole($request, ['owner']);

        $subscription = $workspace->activeSubscription();
        if ($subscription) {
            $subscription->update([
                'status' => 'canceled',
                'canceled_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Subscription has been canceled.',
        ]);
    }

    /**
     * Get lightweight quota & usage summary for Desktop/Web clients.
     */
    public function quota(
        Request $request,
        Workspace $workspace,
        WorkspaceContext $context,
        WorkspaceQuotaService $quotaService
    ): JsonResponse {
        $context->authorizeRole($request, ['owner', 'admin', 'developer', 'viewer']);

        return response()->json([
            'success' => true,
            'data' => [
                'plan' => $workspace->activePlan()->slug,
                'usage' => $quotaService->getUsageSummary($workspace),
            ],
        ]);
    }
}
