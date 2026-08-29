<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connect Workspace · Midnight Hub</title>
    <style>
        :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#04070d;color:#e6f1ff}
        *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 8%,#0c1a2e 0,#070d18 38%,#04070d 82%)}
        body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.3;background-image:linear-gradient(#00f5a015 1px,transparent 1px),linear-gradient(90deg,#00f5a015 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(to bottom,#000,transparent 70%)}
        .glow{position:fixed;width:500px;height:500px;border-radius:50%;background:#00f5a012;filter:blur(80px);pointer-events:none}.card{position:relative;width:min(92vw,560px);padding:36px;border:1px solid #1a2a40;border-radius:28px;background:linear-gradient(145deg,#0a1424fa,#050b15fa);box-shadow:0 30px 90px #000000cc,0 0 0 1px #00f5a01a inset}.brand{display:flex;align-items:center;gap:10px;margin-bottom:26px;color:#8da5ba;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.brand-mark{width:28px;height:28px;border-radius:8px;object-fit:cover;box-shadow:0 0 10px #00f5a040}.eyebrow{color:#00f5a0}.hero{display:flex;gap:18px;align-items:flex-start}.hero-mark{display:grid;place-items:center;flex:0 0 56px;width:56px;height:56px;border:1px solid #00f5a044;border-radius:18px;color:#00f5a0;background:#00f5a010;box-shadow:0 0 24px #00f5a01a}.hero-mark svg{width:28px;height:28px}.kicker{margin:2px 0 6px;color:#7890a4;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.title{margin:0;color:#f4f8ff;font-size:clamp(24px,5vw,32px);line-height:1.1;letter-spacing:-.03em}.sub{margin:10px 0 0;color:#9eb0c2;font-size:13.5px;line-height:1.6}.workspace-box{margin:24px 0 16px;padding:16px;border:1px solid #1e334d;border-radius:16px;background:#07101d}.workspace-label{display:block;margin-bottom:8px;color:#7890a4;font-size:10px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.workspace-select{width:100%;padding:10px 14px;border:1px solid #2d4566;border-radius:10px;background:#0c182a;color:#f1f7ff;font-size:14px;font-weight:600;outline:none}.workspace-select:focus{border-color:#00f5a0;box-shadow:0 0 0 2px #00f5a033}.status{display:flex;align-items:center;gap:8px;margin:0 0 18px;color:#8da5ba;font-size:12px}.dot{width:7px;height:7px;border-radius:99px;background:#00f5a0;box-shadow:0 0 10px #00f5a0}.seal{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;margin-bottom:22px;border:1px dashed #2d425c;border-radius:16px;background:#060d19}.seal small{display:block;margin-bottom:6px;color:#7890a4;font-size:10px;letter-spacing:.12em;text-transform:uppercase}.code{font:800 24px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:#00f5d4}.seal-icon{color:#00f5a0}.actions{display:flex;gap:10px}.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border:1px solid transparent;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;transition:transform .15s,filter .15s}.button:hover{transform:translateY(-1px);filter:brightness(1.08)}.ok{flex:1;background:linear-gradient(135deg,#00f5a0,#00d287);color:#041a12;box-shadow:0 8px 24px #00f5a033}.no{background:#0f1a2a;border-color:#263a54;color:#a8bdd0}.foot{margin:18px 0 0;color:#5a738c;font-size:11px;line-height:1.5;text-align:center}svg{display:block}
        @media(max-width:520px){.card{padding:22px;border-radius:20px}.hero{gap:12px}.hero-mark{flex-basis:44px;width:44px;height:44px}.actions{flex-direction:column}.button{width:100%}.seal{align-items:flex-start;flex-direction:column;gap:10px}.code{font-size:20px}}
    </style>
</head>
<body>
    <div class="glow"></div>
    <main class="card">
        <div class="brand">
            <img class="brand-mark" src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub">
            <span class="eyebrow">Midnight Hub</span>
            <span>·</span>
            <span>Desktop Pairing</span>
        </div>
        <section class="hero">
            <div class="hero-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 8.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z"/>
                    <path d="M9 5.5V3.8M15 5.5V3.8M8.5 12h.01M15.5 12h.01M9 15h6M12 8.5V6"/>
                </svg>
            </div>
            <div>
                <p class="kicker">Browser Approval</p>
                <h1 class="title">Connect Workspace</h1>
                <p class="sub">Authorize your desktop companion to sync tasks, epics and agent workflows.</p>
            </div>
        </section>

        <form method="post" action="/desktop/pairing/{{ $session->pairing_id }}/approve">
            @csrf
            <input type="hidden" name="code" value="{{ $code }}">

            <div class="workspace-box">
                <label class="workspace-label" for="workspace_id">Select Workspace to Connect</label>
                @if(isset($workspaces) && $workspaces->count() > 1)
                    <select id="workspace_id" name="workspace_id" class="workspace-select">
                        @foreach($workspaces as $w)
                            <option value="{{ $w->id }}" {{ (isset($activeWorkspace) && $activeWorkspace->id === $w->id) ? 'selected' : '' }}>
                                {{ $w->name }} ({{ $w->slug }})
                            </option>
                        @endforeach
                    </select>
                @else
                    <div style="font-size:16px; font-weight:700; color:#f1f7ff; padding:4px 0;">
                        {{ $activeWorkspace->name ?? $session->project?->workspace?->name ?? 'Default Workspace' }}
                    </div>
                    <input type="hidden" name="workspace_id" value="{{ $activeWorkspace->id ?? $session->workspace_id ?? '' }}">
                @endif
            </div>

            <p class="status"><span class="dot"></span> Scoped access · restricted to selected workspace</p>

            <div class="seal">
                <div>
                    <small>Pairing code</small>
                    <div class="code">{{ $code }}</div>
                </div>
                <div class="seal-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3.3 19 6v5.2c0 4.3-2.8 7.7-7 9.5-4.2-1.8-7-5.2-7-9.5V6l7-2.7Z"/>
                        <path d="m8.8 12 2.1 2.1 4.4-4.4"/>
                    </svg>
                </div>
            </div>

            <div class="actions">
                <button class="button ok" type="submit">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m5 12.5 4.2 4.2L19 7"/>
                    </svg>
                    Authorize Connection
                </button>
                <button class="button no" type="button" onclick="document.getElementById('deny-form').submit()">
                    Deny
                </button>
            </div>
        </form>

        <form id="deny-form" method="post" action="/desktop/pairing/{{ $session->pairing_id }}/deny" style="display:none">
            @csrf
            <input type="hidden" name="code" value="{{ $code }}">
        </form>

        <p class="foot">Credentials are session-scoped and secrets are never exposed on screen.</p>
    </main>
</body>
</html>
