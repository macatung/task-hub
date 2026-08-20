<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Executive Project & Sprint Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 24px 12px;
      color: #0f172a;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 680px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 32px 28px;
      color: #ffffff;
      text-align: left;
    }
    .header-badge {
      display: inline-block;
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #93c5fd;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .header-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin: 0 0 4px 0;
    }
    .header-scope {
      font-size: 12px;
      color: #cbd5e1;
      margin: 0;
    }
    .content {
      padding: 28px;
    }
    .kpi-grid {
      display: table;
      width: 100%;
      margin-bottom: 28px;
      border-spacing: 8px;
      border-collapse: separate;
    }
    .kpi-row {
      display: table-row;
    }
    .kpi-card {
      display: table-cell;
      width: 25%;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 12px;
      text-align: center;
      vertical-align: top;
    }
    .kpi-val {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 4px;
    }
    .kpi-lbl {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #334155;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 8px;
      margin: 28px 0 16px 0;
    }
    .task-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .task-table th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      text-transform: uppercase;
    }
    .task-table td {
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .task-key {
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      background-color: #eff6ff;
      color: #1d4ed8;
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid #dbeafe;
      white-space: nowrap;
    }
    .badge-priority-urgent {
      background-color: #ffe4e6;
      color: #be123c;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .badge-priority-high {
      background-color: #ffedd5;
      color: #c2410c;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .badge-priority-normal {
      background-color: #f1f5f9;
      color: #475569;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .sprint-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .progress-bar-bg {
      background-color: #e2e8f0;
      height: 8px;
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-bar-fill {
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      height: 100%;
      border-radius: 9999px;
    }
    .warning-box {
      background-color: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 16px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 28px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 28px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header Banner -->
    <div class="header">
      <div class="header-badge">👑 Tasks Hub — Executive Report</div>
      <h1 class="header-title">Weekly Project & Sprint Progress Report</h1>
      <p class="header-subtitle">
        Period: <strong>{{ $period['start_date'] }}</strong> — <strong>{{ $period['end_date'] }}</strong> (Week {{ $period['week_number'] }}/{{ $period['year'] }})
      </p>
      <p class="header-scope">
        Scope: <strong>{{ $scope['selected_projects_label'] ?? 'All Projects' }}</strong>
      </p>
    </div>

    <!-- Main Content -->
    <div class="content">
      <!-- 4 Executive KPI Cards -->
      <table class="kpi-grid" cellpadding="0" cellspacing="8">
        <tr class="kpi-row">
          <td class="kpi-card">
            <div class="kpi-val" style="color: #2563eb;">{{ $kpis['completed_tasks_count'] }}</div>
            <div class="kpi-lbl">Completed Tasks</div>
          </td>
          <td class="kpi-card">
            <div class="kpi-val" style="color: #7c3aed;">{{ $kpis['completed_story_points'] }}</div>
            <div class="kpi-lbl">Points Delivered</div>
          </td>
          <td class="kpi-card">
            <div class="kpi-val" style="color: #10b981;">{{ $kpis['sprint_progress_percent'] }}%</div>
            <div class="kpi-lbl">Sprint Progress</div>
          </td>
          <td class="kpi-card" style="{{ $kpis['warning_tasks_count'] > 0 ? 'background-color: #fff1f2; border-color: #fecdd3;' : '' }}">
            <div class="kpi-val" style="color: {{ $kpis['warning_tasks_count'] > 0 ? '#e11d48' : '#64748b' }};">
              {{ $kpis['warning_tasks_count'] }}
            </div>
            <div class="kpi-lbl">Action Required</div>
          </td>
        </tr>
      </table>

      <!-- Sprint Status Overview -->
      @if(!empty($sprint))
      <div class="sprint-box">
        <table style="width: 100%;">
          <tr>
            <td>
              <strong style="font-size: 15px; color: #0f172a;">🏃 {{ $sprint['name'] }}</strong>
              <span style="font-size: 11px; background-color: #d1fae5; color: #065f46; font-weight: 700; padding: 2px 8px; border-radius: 6px; margin-left: 6px;">ACTIVE</span>
              @if(!empty($sprint['goal']))
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">{{ $sprint['goal'] }}</div>
              @endif
            </td>
            <td style="text-align: right; font-size: 12px; color: #64748b;">
              Target Due: <strong style="color: #0f172a;">{{ $sprint['end_date'] ?? 'N/A' }}</strong>
            </td>
          </tr>
        </table>
        
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {{ $sprint['progress_percent'] }}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 6px;">
          <span>Delivered: <strong>{{ $sprint['done_tasks'] }}/{{ $sprint['total_tasks'] }} tasks</strong> ({{ $sprint['done_points'] }}/{{ $sprint['total_points'] }} pts)</span>
          <span style="font-weight: 700; color: #10b981;">{{ $sprint['progress_percent'] }}%</span>
        </div>
      </div>
      @endif

      <!-- Completed Deliverables in Last 7 Days -->
      <div class="section-title">
        ✅ Deliverables Completed This Week ({{ count($completedTasks) }})
      </div>

      @if(count($completedTasks) > 0)
      <table class="task-table">
        <thead>
          <tr>
            <th style="width: 85px;">Key</th>
            <th>Deliverable / Task Title</th>
            <th style="width: 120px;">Project</th>
            <th style="width: 60px; text-align: right;">Points</th>
          </tr>
        </thead>
        <tbody>
          @foreach($completedTasks as $t)
          <tr>
            <td><span class="task-key">{{ $t->issue_key }}</span></td>
            <td>
              <strong style="color: #1e293b;">{{ $t->title }}</strong>
            </td>
            <td style="font-size: 12px; color: #64748b;">{{ $t->project?->title ?? 'General' }}</td>
            <td style="text-align: right; font-weight: 700; color: #7c3aed;">{{ $t->story_points ? $t->story_points . ' pts' : '-' }}</td>
          </tr>
          @endforeach
        </tbody>
      </table>
      @else
      <p style="font-size: 13px; color: #94a3b8; font-style: italic; text-align: center; padding: 16px;">
        No completed tasks were recorded in this period.
      </p>
      @endif

      <!-- Upcoming Focus for Next Week -->
      <div class="section-title">
        🎯 Key Focus & Priorities For Next Week
      </div>

      @if(count($upcomingTasks) > 0)
      <table class="task-table">
        <thead>
          <tr>
            <th style="width: 85px;">Key</th>
            <th>Priority Focus Item</th>
            <th style="width: 80px;">Priority</th>
            <th style="width: 90px;">Due Date</th>
          </tr>
        </thead>
        <tbody>
          @foreach($upcomingTasks as $ut)
          <tr>
            <td><span class="task-key">{{ $ut->issue_key }}</span></td>
            <td>
              <span style="color: #1e293b; font-weight: 600;">{{ $ut->title }}</span>
            </td>
            <td>
              @if($ut->priority === 'urgent')
                <span class="badge-priority-urgent">Urgent</span>
              @elseif($ut->priority === 'high')
                <span class="badge-priority-high">High</span>
              @else
                <span class="badge-priority-normal">{{ ucfirst($ut->priority) }}</span>
              @endif
            </td>
            <td style="font-size: 11px; color: #64748b;">
              {{ $ut->due_date ? date('d M Y', strtotime($ut->due_date)) : 'TBD' }}
            </td>
          </tr>
          @endforeach
        </tbody>
      </table>
      @endif

      <!-- Warning & Risk Block (If any) -->
      @if(count($warningTasks) > 0)
      <div class="warning-box">
        <strong style="color: #be123c; font-size: 13px; display: block; margin-bottom: 8px;">
          🚨 Schedule Alerts: {{ count($warningTasks) }} item(s) require attention:
        </strong>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #9f1239;">
          @foreach($warningTasks as $wt)
          <li style="margin-bottom: 4px;">
            <strong>{{ $wt['issue_key'] }}</strong>: {{ $wt['title'] }} — 
            @if($wt['is_overdue'])
              <span style="font-weight: 700; color: #be123c;">Overdue by {{ $wt['days_overdue'] }} day(s)</span>
            @else
              <span>Target date: {{ $wt['due_date'] }}</span>
            @endif
          </li>
          @endforeach
        </ul>
      </div>
      @endif

      <!-- CTA Button -->
      <div class="cta-container">
        <a href="{{ url('/tasks') }}" class="cta-button" target="_blank">
          🚀 Open Tasks Hub Workspace →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;">
        Generated and dispatched automatically by <strong>Tasks Hub — macatung.dev</strong>
      </p>
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
        Dispatched at: {{ $period['generated_at'] }} • Confidential — Executive & Management Review Only
      </p>
    </div>
  </div>
</body>
</html>
