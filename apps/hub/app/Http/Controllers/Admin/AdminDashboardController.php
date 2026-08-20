<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactSubmission;
use App\Models\Project;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    /**
     * Display the Admin Dashboard metrics and recent activities
     */
    public function index(): Response
    {
        $totalContacts = ContactSubmission::count();
        $recentContacts = ContactSubmission::latest()->take(5)->get();
        $totalProjects = Project::count();
        $featuredProjects = Project::featured()->count();

        // Group contacts by project type for analytics
        $projectTypeStats = ContactSubmission::selectRaw('project_type, count(*) as count')
            ->groupBy('project_type')
            ->get();

        // Group by coffee offering for fun metrics
        $coffeeStats = ContactSubmission::selectRaw('coffee_offering, count(*) as count')
            ->groupBy('coffee_offering')
            ->get();

        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'total_contacts' => $totalContacts,
                'total_projects' => $totalProjects,
                'featured_projects' => $featuredProjects,
                'coffee_offerings_count' => $coffeeStats->sum('count'),
                'uptime_status' => '100% Operational',
                'active_realm' => 'GMT+7 Midnight Zone',
            ],
            'recent_contacts' => $recentContacts,
            'project_type_stats' => $projectTypeStats,
            'coffee_stats' => $coffeeStats,
        ]);
    }
}
