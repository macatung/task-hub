<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as GitHub OAuth, MCP tokens, webhook secrets, and more. This file provides
    | the de facto location for this type of information.
    |
    */

    'github' => [
        'client_id' => env('GITHUB_CLIENT_ID'),
        'client_secret' => env('GITHUB_CLIENT_SECRET'),
        'redirect' => env('GITHUB_REDIRECT_URI'),
    ],

    'mcp' => [
        'token' => env('TASK_HUB_MCP_TOKEN'),
    ],

    'webhook' => [
        'secret' => env('TASK_HUB_GITHUB_WEBHOOK_SECRET'),
    ],

    'task_hub' => [
        'repository' => env('TASK_HUB_REPOSITORY'),
        'runner_registration_token' => env('TASK_HUB_RUNNER_REGISTRATION_TOKEN'),
        'server_runner_enabled' => filter_var(env('TASK_HUB_SERVER_RUNNER_ENABLED', false), FILTER_VALIDATE_BOOL),
    ],

];
