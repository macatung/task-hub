<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Weekly Task & Project Progress Report Schedule (Checked hourly)
Schedule::command('report:weekly-tasks')->hourly()->withoutOverlapping();
