<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_number',
        'workspace_id',
        'subscription_id',
        'plan_name',
        'billing_cycle',
        'amount',
        'currency',
        'status',
        'billing_reason',
        'description',
        'paid_at',
        'period_start',
        'period_end',
        'pdf_url',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'float',
        'paid_at' => 'datetime',
        'period_start' => 'datetime',
        'period_end' => 'datetime',
        'metadata' => 'array',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(WorkspaceSubscription::class, 'subscription_id');
    }

    public static function generateInvoiceNumber(): string
    {
        $prefix = 'INV-' . date('Ym') . '-';
        $random = Str::padLeft((string) random_int(1, 9999), 4, '0');
        $number = $prefix . $random;

        while (static::where('invoice_number', $number)->exists()) {
            $random = Str::padLeft((string) random_int(1, 9999), 4, '0');
            $number = $prefix . $random;
        }

        return $number;
    }
}
