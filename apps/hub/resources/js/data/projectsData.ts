import type { Project } from '../types/portfolio';

export const projectsData: Project[] = [
  {
    id: 'ai-agent-customer-service-ecosystem',
    title: 'OmniAgent CS — Autonomous Multi-Agent Support & Resolution Platform',
    tagline: 'Autonomous AI agents handling multi-channel customer inquiries, ERP lookups, and instant policy-backed refunds',
    description: 'Enterprise-grade autonomous multi-agent ecosystem delivering 24/7 intelligent customer support. Integrates real-time product RAG, tool/function calling with ERP and database APIs for order lifecycle tracking, automatic ticket classification, and automated refund settlement across Telegram, Zalo, and Web Widgets.',
    category: 'ai-web3',
    coverGradient: 'from-emerald-950 via-teal-900 to-slate-950',
    tags: ['Multi-Agent', 'Gemini AI', 'Function Calling', 'RAG', 'Laravel 12', 'Redis Queue'],
    techStack: ['Multi-Agent Framework', 'Google Gemini AI', 'OpenAI', 'Python / FastAPI', 'Laravel 12', 'Redis Queue', 'Qdrant Vector DB', 'Telegram & Zalo SDK'],
    metrics: [
      { label: 'Automated Resolution Rate', value: '> 92%' },
      { label: 'End-to-End Latency', value: '< 1.2s' },
      { label: 'Operational Cost Reduction', value: '85%' },
    ],
    featured: true,
    architectureHighlights: [
      'Distributed multi-agent topology: Orchestrator Router Agent, ERP Database Tool Agent, and Policy Auditor Refund Agent',
      'Real-time semantic RAG engine synchronizing warranty, returns, and SLA documentation via high-dimensional vector embeddings',
      'Human-in-the-loop escalation circuit: Automatically routes critical edge cases with structured executive context summaries to engineering managers',
      'Asynchronous queue infrastructure supporting thousands of concurrent active conversations without token overflow or rate-limit saturation'
    ],
    midnightFact: 'Autonomously resolved over 12,000 flash-sale disputes and order tracking requests overnight with zero manual intervention.'
  },
  {
    id: 'stock-valuation-financial-management',
    title: 'FinPulse AI — Quantitative Valuation & Intelligent Financial Advisory Platform',
    tagline: '7-year historical fundamental modeling, Gemini AI advisor, and multi-gateway billing integration',
    description: 'Automated quantitative equity valuation and personal wealth analytics platform. Ingests financial statements from major market feeds via 50+ background Artisan jobs, computing EPS trajectories, industry PE medians, dividend yields, and Graham safety margins with integrated Gemini AI advisory.',
    category: 'fullstack',
    coverGradient: 'from-amber-950 via-yellow-900 to-slate-950',
    tags: ['Laravel 12', 'Filament 3', 'Livewire 3', 'Gemini AI', 'SePay QR', 'Zoom API'],
    techStack: ['Laravel 12', 'Filament Admin 3', 'Livewire 3', 'React Native', 'MySQL', 'Google Gemini AI', 'Zoom API', 'SePay / VNPay IPN'],
    metrics: [
      { label: 'Automated Artisan Jobs', value: '50+ Jobs' },
      { label: 'Historical Data Span', value: '7 Years' },
      { label: 'Integrated Payment Gateways', value: '3 Providers' },
    ],
    featured: true,
    architectureHighlights: [
      'Comprehensive quantitative valuation engines: Diluted EPS, sector-normalized P/E, dividend discount models, and Graham margin-of-safety formulas',
      'Real-time market anomaly detection alerting on critical volatility and valuation divergence',
      'Multi-gateway instant payment processing (automated QR verification, IPN callbacks) and integrated Zoom consultation scheduling',
      'Custom Filament Admin 3 interface with multi-tier RBAC and automated financial PDF statement generation'
    ],
    midnightFact: 'Optimized 50+ concurrent background crawlers analyzing 1,500 listed tickers at 2:00 AM daily with sub-second aggregate indexing.'
  },
  {
    id: 'optical-network-gis-qgis-management',
    title: 'GeoFiber — Enterprise Nationwide Optical Fiber Network Management (Web & QGIS)',
    tagline: 'Spatial GIS platform mapping optical cables, manholes, splice closures, and automated shortest-path routing',
    description: 'Nationwide telecommunications fiber infrastructure platform integrated with Geographic Information Systems (GIS) and QGIS. Digitizes physical network assets, tracks maintenance lifecycles, streamlines outage troubleshooting, and optimizes cable route engineering.',
    category: 'tools',
    coverGradient: 'from-cyan-950 via-blue-900 to-slate-950',
    tags: ['GIS / Spatial', 'QGIS Integration', 'PHP / Laravel', 'PostGIS', 'ReactJS'],
    techStack: ['PHP / Laravel', 'PostgreSQL / PostGIS', 'QGIS Spatial Engine', 'ReactJS', 'GeoJSON Map Engine', 'Docker'],
    metrics: [
      { label: 'Managed GIS Nodes', value: '500,000+ Nodes' },
      { label: 'Route Computation Latency', value: '< 180ms' },
      { label: 'Operational Scope', value: 'Nationwide' },
    ],
    featured: true,
    architectureHighlights: [
      'Sub-meter GPS precision mapping down to individual fiber strands, splice trays, manholes, and optical distribution frames',
      'Automated cable route optimization algorithm factoring in terrain slope, available duct capacity, and construction cost models',
      'Remote optical time-domain reflectometer (OTDR) diagnostic integration paired with field technician mobile apps',
      'PostGIS spatial indexing and custom GeoJSON vector tile rendering sustaining smooth 60 FPS viewport navigation'
    ],
    midnightFact: 'Spatial shortest-path algorithm saved hundreds of kilometers of physical fiber during large-scale metropolitan infrastructure rollouts.'
  },
  {
    id: 'nms-transmission-equipment-monitor',
    title: 'NMS Matrix — Real-Time Telecommunications Transmission Network Management',
    tagline: 'SDH/DWDM equipment telemetry, dynamic network topology mapping, and ML-powered anomaly prediction',
    description: 'Centralized Network Management System (NMS) monitoring operational health across thousands of SDH/DWDM transmission devices. Collects and analyzes real-time KPI metrics, detects network degradation, and automates incident classification.',
    category: 'tools',
    coverGradient: 'from-purple-950 via-indigo-900 to-slate-950',
    tags: ['Node.js', 'Python ML', 'Elasticsearch', 'RabbitMQ', 'SNMP / SSH', 'ReactJS'],
    techStack: ['Node.js', 'Python (Machine Learning)', 'Elasticsearch', 'MySQL', 'RabbitMQ', 'ReactJS', 'Protocols: SNMP, Telnet, SSH'],
    metrics: [
      { label: 'Telemetry Monitoring Uptime', value: '99.999%' },
      { label: 'Incident Alert Latency', value: '< 1 Second' },
      { label: 'Connected Equipment', value: '10,000+ Nodes' },
    ],
    featured: false,
    architectureHighlights: [
      'Automated subnet network discovery and configuration backup/rollback over secure SNMP and SSH channels',
      'High-throughput message pipeline ingesting millions of telemetry log records per minute via RabbitMQ and Elasticsearch clusters',
      'Machine learning model forecasting optical signal attenuation and hardware failure risks before service disruption occurs',
      'Interactive real-time SVG network topology canvas dynamically rendering active link states and routing pathways'
    ],
    midnightFact: 'Predictive ML model accurately flagged transmission node voltage drops at 3:30 AM, preventing major downstream outages.'
  },
  {
    id: 'dengue-early-warning-system',
    title: 'DengueRadar — Epidemiological Early Warning & Spatial Heatmap Analytics',
    tagline: 'Clinical case aggregation, multi-variate weather modeling, and mosquito vector density prediction',
    description: 'Public health surveillance platform aggregating and analyzing epidemiological case data across clinics and regional hospitals. Implements predictive modeling correlating clinical cases, meteorological trends (temperature, precipitation), and vector density.',
    category: 'tools',
    coverGradient: 'from-rose-950 via-red-950 to-slate-950',
    tags: ['PHP / Laravel', 'Python Prediction', 'Redis', 'Heatmap GIS', 'Docker'],
    techStack: ['PHP / Laravel', 'MySQL', 'Redis', 'Python (Prediction Algorithms)', 'Docker', 'RESTful APIs'],
    metrics: [
      { label: 'Forecast Accuracy', value: '89.4%' },
      { label: 'Risk Heatmap Resolution', value: 'Real-Time Ward Level' },
      { label: 'Connected Healthcare Centers', value: '120+ Stations' },
    ],
    featured: false,
    architectureHighlights: [
      'Real-time spatial risk heatmaps visualizing outbreak vulnerability across municipal administrative boundaries',
      'Automated alerting dispatch notifying health authorities when environmental and case indicators cross safety thresholds',
      'Secure mobile-optimized APIs for field healthcare workers logging localized incident reports on the ground',
      'Machine learning pipelines correlating climate anomalies with mosquito vector reproduction cycles'
    ],
    midnightFact: 'Forecasting algorithms identified emerging community infection clusters 14 days earlier than traditional reporting methods.'
  },
  {
    id: 'streaming-platform-transcoding',
    title: 'AsiaStream — High-Throughput Video Transcoding & Adaptive Bitrate Distribution',
    tagline: 'Multi-resolution FFmpeg transcoding pipeline, HLS/DASH delivery, and scalable Laravel API Gateway',
    description: 'High-concurrency live broadcasting and video-on-demand (VOD) media processing platform. Features automated multi-resolution video transcoding, adaptive bitrate streaming (HLS/DASH), and multi-region CDN caching.',
    category: 'creative',
    coverGradient: 'from-teal-950 via-slate-900 to-midnight-950',
    tags: ['PHP / Laravel', 'FFmpeg', 'HLS / DASH', 'RabbitMQ', 'Redis', 'CDN'],
    techStack: ['PHP / Laravel', 'FFmpeg Transcoder', 'Redis Queue', 'RabbitMQ', 'MySQL', 'Nginx RTMP / HLS'],
    metrics: [
      { label: 'Transcoding Throughput', value: 'Realtime Hardware' },
      { label: 'Bandwidth Optimization', value: '42%' },
      { label: 'Peak Concurrent Streamers', value: '80,000+' },
    ],
    featured: false,
    architectureHighlights: [
      'Automated multi-bitrate video transcoding pipeline (1080p, 720p, 480p, 360p) with hardware-accelerated encoding',
      'Laravel API Gateway handling user authentication, subscription entitlements, and distributed Redis rate-limiting',
      'Multi-tiered CDN integration reducing egress bandwidth costs and delivering sub-second initial video buffer times',
      'Distributed RabbitMQ job queues balancing heavy video encoding workloads across dedicated GPU worker nodes'
    ],
    midnightFact: 'Sustained championship sports streaming with over 80,000 concurrent viewers overnight with zero dropped frames.'
  }
];
