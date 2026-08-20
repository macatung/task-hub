<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PageView;
use App\Models\AnalyticsEvent;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\DB;

class AdminAnalyticsController extends Controller
{
    /**
     * Display the Full Traffic & Interaction Analytics Dashboard
     */
    public function index(): Response
    {
        $now = Carbon::now();
        $sevenDaysAgo = $now->copy()->subDays(6)->startOfDay();

        // 1. High-Level Summary Stats
        $totalPageviews = PageView::count();
        $uniqueVisitors = PageView::distinct('session_id')->count('session_id');
        $todayPageviews = PageView::whereDate('created_at', $now->toDateString())->count();
        $midnightPageviews = PageView::where('is_midnight', true)->count();
        $midnightRatio = $totalPageviews > 0 ? round(($midnightPageviews / $totalPageviews) * 100, 1) : 0;

        // 2. 7-Day Daily Traffic Trend (For Line Chart)
        $dailyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->copy()->subDays($i);
            $dayDate = $day->toDateString();
            $label = $day->format('d/m');

            $views = PageView::whereDate('created_at', $dayDate)->count();
            $uniques = PageView::whereDate('created_at', $dayDate)->distinct('session_id')->count('session_id');

            $dailyTrend[] = [
                'date' => $dayDate,
                'label' => $label,
                'views' => $views,
                'uniques' => $uniques,
            ];
        }

        // 3. 24-Hour Traffic Distribution (For Hourly Bar Chart / Midnight Heatmap)
        $hourlyStats = [];
        for ($h = 0; $h < 24; $h++) {
            $count = PageView::whereRaw("strftime('%H', created_at) = ?", [sprintf('%02d', $h)])->count();
            $hourlyStats[] = [
                'hour' => sprintf('%02d:00', $h),
                'count' => $count,
                'is_midnight' => ($h >= 0 && $h <= 5),
            ];
        }

        // 4. Device Breakdown (For Donut / Progress Bar)
        $deviceCounts = PageView::select('device_type', DB::raw('count(*) as count'))
            ->groupBy('device_type')
            ->get();
        $deviceBreakdown = [
            'desktop' => $deviceCounts->firstWhere('device_type', 'desktop')?->count ?? 0,
            'mobile' => $deviceCounts->firstWhere('device_type', 'mobile')?->count ?? 0,
            'tablet' => $deviceCounts->firstWhere('device_type', 'tablet')?->count ?? 0,
        ];

        // 5. Top Referrers
        $topReferrers = PageView::select('referrer', DB::raw('count(*) as count'))
            ->whereNotNull('referrer')
            ->where('referrer', '!=', '')
            ->groupBy('referrer')
            ->orderByDesc('count')
            ->take(6)
            ->get()
            ->map(function ($r) {
                $host = parse_url($r->referrer, PHP_URL_HOST) ?: $r->referrer;
                return [
                    'source' => $host,
                    'url' => $r->referrer,
                    'count' => $r->count,
                ];
            });

        // 6. Interaction Events Counters
        $eventCounters = [
            'hop_mascot' => AnalyticsEvent::where('event_type', 'hop_mascot')->count(),
            'cv_download' => AnalyticsEvent::where('event_type', 'cv_download')->count(),
            'cli_executed' => AnalyticsEvent::where('event_type', 'cli_executed')->count(),
            'talisman_blessed' => AnalyticsEvent::where('event_type', 'talisman_blessed')->count(),
        ];

        // 7. Recent 15 Pageviews Feed
        $recentPageviews = PageView::latest('created_at')->take(15)->get();

        return Inertia::render('Admin/Analytics/Index', [
            'overview' => [
                'total_pageviews' => $totalPageviews,
                'unique_visitors' => $uniqueVisitors,
                'today_pageviews' => $todayPageviews,
                'midnight_ratio' => $midnightRatio,
            ],
            'daily_trend' => $dailyTrend,
            'hourly_stats' => $hourlyStats,
            'device_breakdown' => $deviceBreakdown,
            'top_referrers' => $topReferrers,
            'event_counters' => $eventCounters,
            'recent_pageviews' => $recentPageviews,
        ]);
    }
}
