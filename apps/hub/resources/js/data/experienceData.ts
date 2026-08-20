import type { ExperienceItem, DeveloperStat } from '../types/portfolio';

export const experienceData: ExperienceItem[] = [
  {
    id: 'lead-ai-agent-architect',
    period: '2025 — Hiện Tại',
    role: 'Lead AI Agent & Autonomous Systems Architect',
    company: 'Enterprise AI & Automation Solutions',
    location: 'Remote / Global',
    type: 'Full-time',
    summary: 'Thiết kế và triển khai hệ thống Multi-Agent AI tự trị thay thế toàn diện đội ngũ Customer Service 24/7, tích hợp RAG, Function Calling, CRM/Telegram/Zalo webhook và tự động giải quyết tranh chấp hoàn tiền.',
    achievements: [
      'Xây dựng Multi-Agent CS giải quyết tự động > 92% khiếu nại khách hàng, giảm 85% chi phí vận hành nhân sự CS.',
      'Tích hợp Tool/Function Calling với API ERP/Database tra cứu đơn hàng, tự động đối soát và hoàn tiền với độ trễ < 1.2s.',
      'Triển khai hệ thống RAG thời gian thực với Vector Database, tự động cập nhật tri thức sản phẩm & chính sách bảo hành mới nhất.'
    ],
    technologies: ['Multi-Agent Orchestration', 'Google Gemini AI', 'OpenAI', 'Python / FastAPI', 'Laravel 12', 'Redis Queue', 'Vector DB'],
    midnightQuest: 'Đêm 3:00 AM yểm bùa kiến trúc Multi-Agent tự động chặn 10,000 ca khiếu nại hoàn tiền gian lận trong đợt Mega Sale.'
  },
  {
    id: 'senior-fullstack-systems-lead',
    period: '02/2022 — 06/2025',
    role: 'Fullstack Developer & Senior Systems Architect',
    company: 'Telecom Infrastructure & GIS Technologies',
    location: 'Ho Chi Minh City',
    type: 'Full-time',
    summary: 'Chủ trì thiết kế và phát triển các hệ thống hạ tầng viễn thông, số hóa mạng lưới cáp quang toàn quốc (GIS/QGIS), hệ thống giám sát thiết bị truyền dẫn (NMS), hệ thống cảnh báo sớm dịch bệnh sốt xuất huyết và quản lý địa chỉ IP.',
    achievements: [
      'Xây dựng hệ thống GIS số hóa mạng cáp quang toàn quốc, tích hợp QGIS phân tích dữ liệu không gian và tự động định tuyến cáp tối ưu.',
      'Phát triển Network Management System (NMS) giám sát thời gian thực thiết bị truyền dẫn SDH/DWDM qua SNMP/Telnet/SSH với cảnh báo dị thường Machine Learning.',
      'Xây dựng hệ thống cảnh báo sớm dịch sốt xuất huyết kết hợp bản đồ nhiệt Heatmap và thuật toán dự báo theo thời tiết/mật độ muỗi.',
      'Phát triển hệ thống IP Management tính toán subnet tự động, quản lý phân cấp IP quy mô lớn trên Laravel + Filament Admin.'
    ],
    technologies: ['PHP / Laravel', 'Filament Admin', 'Node.js', 'Python (Data/ML)', 'Elasticsearch', 'MySQL', 'Redis', 'RabbitMQ', 'ReactJS', 'QGIS / Spatial GIS', 'SNMP'],
    midnightQuest: 'Tối ưu hóa thuật toán định tuyến cáp quang GIS trên bản đồ 500,000 điểm nút giúp giảm thời gian tính toán từ 12s xuống < 180ms.'
  },
  {
    id: 'backend-streaming-engineer',
    period: '06/2017 — 01/2022',
    role: 'Backend Web Developer & Streaming Engineer',
    company: 'Media & High-Throughput Streaming Corporation',
    location: 'Ho Chi Minh City',
    type: 'Full-time',
    summary: 'Kiến trúc nền tảng xử lý và phân phối media/video streaming tải cao, chuyển mã tự động đa độ phân giải và cổng API Gateway bảo mật.',
    achievements: [
      'Xây dựng pipeline chuyển mã video tự động đa độ phân giải (FFmpeg) và phát trực tuyến thích ứng Adaptive Bitrate Streaming (HLS/DASH).',
      'Tích hợp CDN đa tầng tối ưu hóa chi phí băng thông 42% và thời gian tải đệm video xuống sub-second.',
      'Phát triển Laravel API Gateway chịu tải xác thực, phân quyền và rate-limiting hàng triệu requests mỗi ngày với Redis & RabbitMQ.'
    ],
    technologies: ['PHP / Laravel', 'FFmpeg', 'Redis', 'RabbitMQ', 'MySQL', 'Nginx', 'HLS/DASH Streaming', 'Docker'],
    midnightQuest: 'Cứu nguy đường truyền trực tiếp chung kết thể thao lúc nửa đêm với 80,000 CCU bằng cơ chế dynamic CDN failover.'
  },
  {
    id: 'informatics-prodigy-foundation',
    period: '2013 — 2018',
    role: 'National Informatics Prodigy & Software Engineer',
    company: 'National Informatics Olympiad & CS Academy',
    location: 'Ho Chi Minh City',
    type: 'Education & Awards',
    summary: 'Đoạt giải Khuyến khích Quốc gia môn Tin học, rèn giũa nền tảng thuật toán chuyên sâu, cấu trúc dữ liệu, tư duy hệ thống và văn hóa gõ code xuyên đêm.',
    achievements: [
      'Đạt Giải Khuyến khích Quốc gia môn Tin học (National Informatics Incentive Award).',
      '2 năm liên tiếp đạt Giải Nhì Tin học Cấp Tỉnh (2012 & 2013).',
      'Tốt nghiệp xuất sắc chuyên ngành Công Nghệ Thông Tin & Kỹ Thuật Phần Mềm.'
    ],
    technologies: ['C/C++', 'Algorithms & Data Structures', 'Linux', 'Git', 'PHP', 'MySQL'],
    midnightQuest: 'Luyện giải thuật marathon 48h không ngủ, đặt nền móng cho triết lý "Code at Midnight".'
  }
];

export const developerStats: DeveloperStat[] = [
  {
    label: 'Kinh Nghiệm Thực Chiến',
    value: '8+ Năm',
    unit: 'Senior',
    iconName: 'Zap',
    description: 'Từ 2017 đến nay qua các hệ thống tải cao & AI Agents'
  },
  {
    label: 'Tỉ Lệ CS Tự Động Hóa',
    value: '92%+',
    unit: 'Auto CS',
    iconName: 'Cpu',
    description: 'Multi-Agent AI xử lý khiếu nại & hoàn tiền 24/7'
  },
  {
    label: 'Hạ Tầng GIS & Thiết Bị',
    value: '500K+',
    unit: 'Nodes',
    iconName: 'Server',
    description: 'Quản lý cáp quang & thiết bị truyền dẫn NMS'
  },
  {
    label: 'Uptime Cam Kết Đêm',
    value: '99.99%',
    unit: 'SLA',
    iconName: 'Shield',
    description: 'Kiến trúc chịu tải & Zero Downtime 00:00 AM'
  }
];
