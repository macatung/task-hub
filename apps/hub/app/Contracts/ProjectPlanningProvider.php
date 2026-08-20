<?php

namespace App\Contracts;

interface ProjectPlanningProvider
{
    /**
     * @return array<string, mixed>
     */
    public function generatePlan(string $prompt, array $options = []): array;
}
