<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $plans = [
            [
                'slug' => 'community',
                'name' => 'Community',
                'tagline' => 'For individual hackers and open-source contributors',
                'description' => 'Free forever with local desktop runner support and standard features.',
                'price_monthly' => 0.00,
                'price_yearly' => 0.00,
                'currency' => 'USD',
                'max_runners' => 1,
                'max_seats' => 1,
                'max_projects' => 3,
                'features' => [
                    '1 Concurrent Desktop Runner',
                    'Up to 3 Active Projects',
                    '1 Personal Seat',
                    'Basic GitHub Repository Sync',
                    'Community Discord Support',
                    'Local Agent Run History (7 days)',
                ],
                'limits' => [
                    'history_retention_days' => 7,
                    'custom_mcp' => false,
                    'team_roles' => false,
                    'priority_queue' => false,
                ],
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 1,
            ],
            [
                'slug' => 'pro',
                'name' => 'Pro Developer',
                'tagline' => 'For professional engineers supercharging their local AI workflow',
                'description' => 'Triple concurrent execution, unlimited projects, and priority streaming.',
                'price_monthly' => 19.00,
                'price_yearly' => 180.00,
                'currency' => 'USD',
                'max_runners' => 3,
                'max_seats' => 1,
                'max_projects' => null,
                'features' => [
                    '3 Concurrent Desktop Runners',
                    'Unlimited Projects & Roadmaps',
                    '1 Developer Seat',
                    'Priority AI Task Dispatching',
                    'Fast SSE Realtime Log Streaming',
                    'Automated GitHub PR Creation',
                    'Run History (90 days)',
                    'Standard Email Support',
                ],
                'limits' => [
                    'history_retention_days' => 90,
                    'custom_mcp' => true,
                    'team_roles' => false,
                    'priority_queue' => true,
                ],
                'is_active' => true,
                'is_popular' => true,
                'sort_order' => 2,
            ],
            [
                'slug' => 'team',
                'name' => 'Team / Startup',
                'tagline' => 'For engineering squads collaborating with multi-agent swarms',
                'description' => '10 concurrent runners, 10 team seats, role-based access, and shared vaults.',
                'price_monthly' => 49.00,
                'price_yearly' => 468.00,
                'currency' => 'USD',
                'max_runners' => 10,
                'max_seats' => 10,
                'max_projects' => null,
                'features' => [
                    '10 Concurrent Desktop Runners',
                    '10 Team Member Seats',
                    'Unlimited Projects & Epics',
                    'Team Credential Vault Sharing',
                    'Role-Based Access Control (Admin/Dev/Viewer)',
                    'Multi-runner Fleet Dashboard',
                    'Team Analytics & Velocity Metrics',
                    'Priority Support with 24h SLA',
                ],
                'limits' => [
                    'history_retention_days' => 365,
                    'custom_mcp' => true,
                    'team_roles' => true,
                    'priority_queue' => true,
                ],
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 3,
            ],
            [
                'slug' => 'enterprise',
                'name' => 'Enterprise',
                'tagline' => 'For large organizations needing custom capacity and dedicated governance',
                'description' => 'Unlimited scale, custom security appliances, SAML SSO, and dedicated SLA.',
                'price_monthly' => 199.00,
                'price_yearly' => 1908.00,
                'currency' => 'USD',
                'max_runners' => null,
                'max_seats' => null,
                'max_projects' => null,
                'features' => [
                    'Unlimited Concurrent Runners & Fleets',
                    'Unlimited Team Seats',
                    'Dedicated On-Premise Runner Appliances',
                    'Custom SAML/SSO & Okta Integration',
                    'Enterprise Security & Audit Logging',
                    'Custom Model Context Protocol (MCP) Connectors',
                    'Dedicated Account Manager & 99.9% SLA',
                    'Custom Invoicing & Procurement Support',
                ],
                'limits' => [
                    'history_retention_days' => 730,
                    'custom_mcp' => true,
                    'team_roles' => true,
                    'priority_queue' => true,
                    'sso_enabled' => true,
                ],
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 4,
            ],
        ];

        foreach ($plans as $planData) {
            Plan::updateOrCreate(
                ['slug' => $planData['slug']],
                $planData
            );
        }
    }
}
