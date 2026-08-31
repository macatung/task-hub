import type { ExperienceItem, DeveloperStat } from '../types/portfolio';

export const experienceData: ExperienceItem[] = [
  {
    id: 'lead-ai-agent-architect',
    period: '2025 — Present',
    role: 'Lead AI Agent & Autonomous Systems Architect',
    company: 'Enterprise AI & Automation Solutions',
    location: 'Remote / Global',
    type: 'Full-time',
    summary: 'Architecting and deploying autonomous multi-agent AI ecosystems providing 24/7 intelligent customer support and automated resolution, integrating RAG, Tool Calling, CRM/Telegram/Zalo webhooks, and automated dispute settlement.',
    achievements: [
      'Engineered Multi-Agent CS architecture autonomously resolving > 92% of customer inquiries and reducing support overhead by 85%.',
      'Integrated real-time Tool/Function Calling with ERP and database APIs for order lifecycle tracking and automated refund settlements with sub-1.2s latency.',
      'Deployed real-time RAG pipeline over high-dimensional vector databases, synchronizing live product knowledge and SLA policy updates.'
    ],
    technologies: ['Multi-Agent Orchestration', 'Google Gemini AI', 'OpenAI', 'Python / FastAPI', 'Laravel 12', 'Redis Queue', 'Vector DB'],
    midnightQuest: 'Engineered multi-agent fraud mitigation algorithms overnight, intercepting 10,000+ illegitimate refund requests during high-volume flash sales.'
  },
  {
    id: 'senior-fullstack-systems-lead',
    period: '02/2022 — 06/2025',
    role: 'Fullstack Developer & Senior Systems Architect',
    company: 'Telecom Infrastructure & GIS Technologies',
    location: 'Ho Chi Minh City',
    type: 'Full-time',
    summary: 'Led the architectural design and implementation of mission-critical telecom infrastructure systems, nationwide optical fiber GIS mapping (Web & QGIS), transmission telemetry monitoring (NMS), and epidemiological risk surveillance platforms.',
    achievements: [
      'Engineered nationwide spatial GIS platform mapping 500,000+ optical fiber nodes with automated shortest-path cable routing under 180ms.',
      'Developed real-time Network Management System (NMS) monitoring SDH/DWDM transmission devices over SNMP/SSH with ML-driven predictive alerts.',
      'Constructed dengue epidemiological early warning system combining spatial risk heatmaps and meteorological predictive modeling.',
      'Implemented automated IP address management (IPAM) suite handling large-scale subnet allocation and hierarchical RBAC on Laravel and Filament.'
    ],
    technologies: ['PHP / Laravel', 'Filament Admin', 'Node.js', 'Python (Data/ML)', 'Elasticsearch', 'MySQL', 'Redis', 'RabbitMQ', 'ReactJS', 'QGIS / Spatial GIS', 'SNMP'],
    midnightQuest: 'Optimized PostGIS spatial routing algorithms across 500,000 network nodes, slashing calculation latency from 12s down to < 180ms.'
  },
  {
    id: 'backend-streaming-engineer',
    period: '06/2017 — 01/2022',
    role: 'Backend Web Developer & Streaming Engineer',
    company: 'Media & High-Throughput Streaming Corporation',
    location: 'Ho Chi Minh City',
    type: 'Full-time',
    summary: 'Architected high-throughput live broadcasting and video-on-demand processing systems, automated multi-resolution hardware transcoding pipelines, and hardened API gateways.',
    achievements: [
      'Constructed automated multi-resolution FFmpeg transcoding pipelines delivering adaptive bitrate streaming (HLS/DASH).',
      'Integrated multi-tier CDN architecture slashing egress bandwidth costs by 42% and achieving sub-second initial buffer latency.',
      'Engineered Laravel API Gateway processing millions of authenticated daily requests with distributed Redis caching and RabbitMQ rate-limiting.'
    ],
    technologies: ['PHP / Laravel', 'FFmpeg', 'Redis', 'RabbitMQ', 'MySQL', 'Nginx', 'HLS/DASH Streaming', 'Docker'],
    midnightQuest: 'Maintained zero-downtime championship streaming for 80,000 concurrent viewers overnight via dynamic multi-CDN failover circuits.'
  },
  {
    id: 'informatics-prodigy-foundation',
    period: '2013 — 2018',
    role: 'National Informatics Prodigy & Software Engineer',
    company: 'National Informatics Olympiad & CS Academy',
    location: 'Ho Chi Minh City',
    type: 'Education & Awards',
    summary: 'National Informatics Olympiad laureate, mastering algorithmic complexity, deep data structures, distributed systems foundations, and intense problem-solving focus.',
    achievements: [
      'Awarded National Informatics Olympiad Laureate (National CS Competition).',
      'Two-time Provincial First Runner-Up in Informatics Olympiad (2012 & 2013).',
      'Graduated with honors in Computer Science & Software Engineering.'
    ],
    technologies: ['C/C++', 'Algorithms & Data Structures', 'Linux', 'Git', 'PHP', 'MySQL'],
    midnightQuest: '48-hour continuous algorithmic marathon sessions, forging the foundational discipline of the "Code at Midnight" philosophy.'
  }
];

export const developerStats: DeveloperStat[] = [
  {
    label: 'Production Experience',
    value: '8+ Years',
    unit: 'Senior',
    iconName: 'Zap',
    description: 'Since 2017 across high-throughput distributed systems & AI swarms'
  },
  {
    label: 'Customer Support Automation',
    value: '92%+',
    unit: 'Auto CS',
    iconName: 'Cpu',
    description: 'Autonomous multi-agent resolution and instant refund settlement'
  },
  {
    label: 'GIS & Telecom Infra',
    value: '500K+',
    unit: 'Nodes',
    iconName: 'Server',
    description: 'Optical fiber networks and NMS equipment monitoring'
  },
  {
    label: 'Committed SLA Uptime',
    value: '99.99%',
    unit: 'SLA',
    iconName: 'Shield',
    description: 'High-availability infrastructure with continuous 24/7 reliability'
  }
];
