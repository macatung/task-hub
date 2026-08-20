import type { SkillCategory } from '../types/portfolio';

export const skillsData: SkillCategory[] = [
  {
    title: 'AI Agents & LLM Architecture',
    iconName: 'Sparkles',
    badge: 'Autonomous Systems',
    skills: [
      { name: 'Multi-Agent Orchestration', level: 96, rune: '🤖', tag: 'Core AI', description: 'Autonomous agents, router agents, human-in-the-loop workflows & task delegation.' },
      { name: 'Tool & Function Calling', level: 98, rune: '⚡', tag: 'Automation', description: 'Real-time database queries, API ERP integration, automated refunding & ticket solving.' },
      { name: 'RAG & Vector Databases', level: 94, rune: '🧠', tag: 'GenAI', description: 'Semantic search, Qdrant / PgVector embeddings, knowledge graph retrieval & token optimization.' },
      { name: 'Google Gemini & OpenAI APIs', level: 96, rune: '🔮', tag: 'LLM APIs', description: 'Interactions API, Live API, prompt engineering, structured JSON outputs & safety guards.' },
      { name: 'Python (FastAPI / LangChain)', level: 92, rune: '🐍', tag: 'AI Backend', description: 'Async AI microservices, LlamaIndex data pipelines & ML prediction wrappers.' },
    ],
  },
  {
    title: 'Backend Mastery & Distributed Systems',
    iconName: 'Server',
    badge: 'High-Throughput',
    skills: [
      { name: 'PHP 8.3+ & Laravel 11/12', level: 98, rune: '🐘', tag: 'Expert', description: 'Complex domain logic, Inertia fullstack, Eloquent optimization & microservices architecture.' },
      { name: 'Filament Admin 3 & Livewire 3', level: 95, rune: '⚡', tag: 'Admin UI', description: 'Rapid enterprise dashboards, dynamic tables, custom form widgets & role permissions.' },
      { name: 'Redis Caching & Atomic Locks', level: 96, rune: '⚡', tag: 'Realtime', description: 'Distributed locks, rate-limiting, pub/sub channels & high-speed session states.' },
      { name: 'RabbitMQ & Message Queues', level: 94, rune: '🐇', tag: 'Queue', description: 'Asynchronous event streaming, dead-letter exchanges & worker load balancing.' },
      { name: 'PostgreSQL & MySQL Database Design', level: 95, rune: '🗄️', tag: 'Database', description: 'Complex indexing strategies, partition tables, query optimization & ACID transactions.' },
    ],
  },
  {
    title: 'Telecom, GIS & Network Systems',
    iconName: 'Layout',
    badge: 'Specialized Infra',
    skills: [
      { name: 'GIS & Spatial Data (QGIS)', level: 92, rune: '🗺️', tag: 'Spatial', description: 'Digital mapping of nationwide fiber infrastructure, PostGIS spatial queries & route optimization.' },
      { name: 'NMS & Telecom Protocols', level: 90, rune: '📡', tag: 'Protocols', description: 'SNMP, Telnet, SSH equipment monitoring, SDH/DWDM performance metrics & auto-discovery.' },
      { name: 'Elasticsearch & Log Analytics', level: 92, rune: '🔍', tag: 'Big Data', description: 'High-volume log indexing, real-time anomaly detection & telemetry aggregation.' },
      { name: 'Video Transcoding & Streaming', level: 93, rune: '🎬', tag: 'Streaming', description: 'FFmpeg hardware acceleration, HLS/DASH adaptive bitrate streaming & CDN caching.' },
    ],
  },
  {
    title: 'Frontend Sorcery, Cloud & DevOps',
    iconName: 'Cloud',
    badge: '99.99% Uptime',
    skills: [
      { name: 'Vue 3 & ReactJS / React Native', level: 94, rune: '⚛️', tag: 'Frontend', description: 'Composition API, state management (Pinia), mobile apps & responsive interfaces.' },
      { name: 'TypeScript Strict & Modern CSS', level: 95, rune: '📘', tag: 'Type-Safe', description: 'Zero runtime errors, fluid TailwindCSS design systems & glassmorphism aesthetics.' },
      { name: 'Docker & Multi-Stage Builds', level: 93, rune: '🐳', tag: 'Containers', description: 'Alpine production images, docker-compose orchestration & isolated microservices.' },
      { name: 'CI/CD GitHub Actions & Cloudflare', level: 92, rune: '🌐', tag: 'DevOps', description: 'Automated testing pipelines, CDN rule caching, DDoS protection & zero-downtime deploys.' },
    ],
  },
];
