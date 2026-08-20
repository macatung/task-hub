import type { Project } from '../types/portfolio';

export const projectsData: Project[] = [
  {
    id: 'ai-agent-customer-service-ecosystem',
    title: 'OmniAgent CS — Hệ Thống Multi-Agent AI Tự Trị Thay Thế Customer Service 24/7',
    tagline: 'Multi-Agent AI tự động tiếp nhận khiếu nại, tra cứu database đơn hàng, đối soát và hoàn tiền đa kênh',
    description: 'Hệ sinh thái Multi-Agent AI tự trị thay thế 100% đội ngũ Customer Service truyền thống. Tích hợp RAG tri thức sản phẩm, Tool/Function Calling với API ERP/Database tra cứu trạng thái đơn hàng, tự động phân loại ticket, giải quyết tranh chấp và hoàn tiền tức thì trên đa kênh (Telegram, Zalo, Web Widget).',
    category: 'ai-web3',
    coverGradient: 'from-emerald-950 via-teal-900 to-slate-950',
    tags: ['Multi-Agent', 'Gemini AI', 'Function Calling', 'RAG', 'Laravel 12', 'Redis Queue'],
    techStack: ['Multi-Agent Framework', 'Google Gemini AI', 'OpenAI', 'Python / FastAPI', 'Laravel 12', 'Redis Queue', 'Qdrant Vector DB', 'Telegram & Zalo SDK'],
    metrics: [
      { label: 'Tỉ Lệ Giải Quyết Tự Động', value: '> 92%' },
      { label: 'Thời Gian Phản Hồi', value: '< 1.2s' },
      { label: 'Tiết Kiệm Chi Phí CS', value: '85%' },
    ],
    featured: true,
    architectureHighlights: [
      'Kiến trúc Multi-Agent phân tán: Agent điều phối (Router), Agent tra cứu ERP (Database Tool), Agent thẩm định hoàn tiền (Policy Auditor)',
      'Hệ thống RAG ngữ nghĩa thời gian thực cập nhật chính sách bảo hành, đổi trả và FAQ mới nhất từ Vector Database',
      'Cơ chế Human-in-the-loop: Tự động chuyển tiếp thông báo khẩn cấp kèm tóm tắt ngữ cảnh cho Quản lý khi phát hiện trường hợp rủi ro cao',
      'Hàng đợi bất đồng bộ xử lý song song hàng ngàn phiên hội thoại thời gian thực mà không bị nghẽn API hay tràn token'
    ],
    midnightFact: 'Hệ thống tự động xử lý hơn 12,000 ca khiếu nại và tra cứu đơn hàng trong đêm Flash Sale mà không cần bất kỳ nhân sự CS nào trực ca.'
  },
  {
    id: 'stock-valuation-financial-management',
    title: 'FinPulse AI — Nền Tảng Định Giá Cổ Phiếu & Cố Vấn Tài Chính Thông Minh',
    tagline: 'Thuật toán định giá 7 năm, trợ lý tài chính Gemini AI, tích hợp MoMo, VNPay, SePay QR & Zoom API',
    description: 'Hệ thống định giá cổ phiếu chuyên sâu và quản lý tài chính cá nhân tự động hóa. Tự động thu thập dữ liệu tài chính từ CafeF, SSI, VNStock qua 50+ Artisan commands, tính toán EPS, P/E, Cổ tức và Biên An Toàn (Safety Margin) cùng chatbot cố vấn thông minh Google Gemini AI.',
    category: 'fullstack',
    coverGradient: 'from-amber-950 via-yellow-900 to-slate-950',
    tags: ['Laravel 12', 'Filament 3', 'Livewire 3', 'Gemini AI', 'SePay QR', 'Zoom API'],
    techStack: ['Laravel 12', 'Filament Admin 3', 'Livewire 3', 'React Native', 'MySQL', 'Google Gemini AI', 'Zoom API', 'SePay / VNPay IPN'],
    metrics: [
      { label: 'Artisan Commands Tự Động', value: '50+ Jobs' },
      { label: 'Dữ Liệu Lịch Sử Phân Tích', value: '7 Năm' },
      { label: 'Cổng Thanh Toán Tích Hợp', value: '3 Cổng (SePay/VNPay/MoMo)' },
    ],
    featured: true,
    architectureHighlights: [
      'Công cụ tính toán tài chính chuyên sâu: EPS pha loãng, P/E trung bình ngành, lợi suất cổ tức tiền mặt & cổ phiếu thưởng, định giá Graham',
      'Hệ thống cảnh báo biến động giá thời gian thực với cảnh báo tăng/giảm sốc bắn notification tức thì',
      'Tích hợp đa cổng thanh toán (SePay QR tự động xác nhận, VNPay IPN callback, MoMo) và đặt lịch tư vấn tự tạo phòng Zoom API',
      'Bảng điều khiển quản trị Filament Admin 3 tối ưu hóa phân quyền đa cấp và xuất báo cáo PDF tài chính tự động'
    ],
    midnightFact: 'Tối ưu 50+ Artisan crawler tự động crawl và phân tích dữ liệu 1,500 mã cổ phiếu sàn HOSE/HNX lúc 2:00 AM mỗi ngày.'
  },
  {
    id: 'optical-network-gis-qgis-management',
    title: 'GeoFiber — Hệ Thống Số Hóa & Quản Trị Mạng Cáp Quang Toàn Quốc (Web & QGIS)',
    tagline: 'Bản đồ số GIS quản lý cáp quang, hố ga, tủ cáp, măng xông và tự động gợi ý tuyến cáp tối ưu',
    description: 'Hệ thống quản lý cơ sở hạ tầng mạng cáp quang quy mô toàn quốc tích hợp Hệ thống Thông tin Địa lý (GIS) và QGIS. Số hóa toàn bộ tài sản mạng viễn thông, theo dõi bảo trì, quản lý sự cố và tối ưu hóa tuyến cáp/băng thông.',
    category: 'tools',
    coverGradient: 'from-cyan-950 via-blue-900 to-slate-950',
    tags: ['GIS / Spatial', 'QGIS Integration', 'PHP / Laravel', 'PostGIS', 'ReactJS'],
    techStack: ['PHP / Laravel', 'PostgreSQL / PostGIS', 'QGIS Spatial Engine', 'ReactJS', 'GeoJSON Map Engine', 'Docker'],
    metrics: [
      { label: 'Điểm Nút GIS Quản Lý', value: '500,000+ Nodes' },
      { label: 'Tốc Độ Định Tuyến Tuyến Cáp', value: '< 180ms' },
      { label: 'Phạm Vi Quản Trị', value: 'Toàn Quốc' },
    ],
    featured: true,
    architectureHighlights: [
      'Bản đồ số hóa chi tiết tới từng sợi quang, hố ga, tủ cáp, măng xông và mối hàn với tọa độ GPS chính xác',
      'Thuật toán tự động đề xuất tuyến kéo cáp tối ưu nhất dựa trên địa hình, dung lượng cổng trống và chi phí thi công',
      'Tích hợp thiết bị đo kiểm và giám sát từ xa kết hợp ứng dụng di động cho kỹ thuật viên hiện trường',
      'Tối ưu hóa truy vấn không gian PostGIS và cơ chế spatial index giúp render bản đồ mượt mà 60 FPS'
    ],
    midnightFact: 'Thuật toán tối ưu hóa tuyến cáp giúp tiết kiệm hàng trăm kilômét cáp quang trong dự án triển khai hạ tầng viễn thông.'
  },
  {
    id: 'nms-transmission-equipment-monitor',
    title: 'NMS Matrix — Hệ Thống Giám Sát Thiết Bị Truyền Dẫn Viễn Thông Thời Gian Thực',
    tagline: 'Giám sát thiết bị SDH/DWDM, bản đồ topology mạng động và dự đoán sự cố bằng Machine Learning',
    description: 'Hệ thống quản trị mạng trung tâm (Network Management System) giám sát trạng thái hoạt động của hàng ngàn thiết bị truyền dẫn SDH/DWDM trên toàn mạng lưới. Thu thập và phân tích chỉ số hiệu năng (KPI), phát hiện dị thường và tự động phân loại sự cố.',
    category: 'tools',
    coverGradient: 'from-purple-950 via-indigo-900 to-slate-950',
    tags: ['Node.js', 'Python ML', 'Elasticsearch', 'RabbitMQ', 'SNMP / SSH', 'ReactJS'],
    techStack: ['Node.js', 'Python (Machine Learning)', 'Elasticsearch', 'MySQL', 'RabbitMQ', 'ReactJS', 'Protocols: SNMP, Telnet, SSH'],
    metrics: [
      { label: 'Uptime Giám Sát', value: '99.999%' },
      { label: 'Độ Trễ Cảnh Báo Sự Cố', value: '< 1 Giây' },
      { label: 'Thiết Bị Kết Nối', value: '10,000+ Nodes' },
    ],
    featured: false,
    architectureHighlights: [
      'Tự động quét phát hiện thiết bị mạng mới (Auto-Discovery) và sao lưu/khôi phục cấu hình tự động',
      'Xử lý hàng triệu bản tin log và cảnh báo mỗi phút qua RabbitMQ và lưu trữ phân tích trên Elasticsearch',
      'Mô hình Machine Learning dự đoán trước nguy cơ suy hao đường truyền và sự cố phần cứng trước khi đứt mạng',
      'Giao diện sơ đồ mạng Topology tương tác thời gian thực cập nhật trạng thái kết nối tức thì'
    ],
    midnightFact: 'Mô hình ML dự đoán chính xác sự cố sụt áp trạm truyền dẫn lúc 3:30 AM, giúp kỹ thuật viên xử lý trước khi gián đoạn dịch vụ.'
  },
  {
    id: 'dengue-early-warning-system',
    title: 'DengueRadar — Hệ Thống Cảnh Báo Sớm & Bản Đồ Nhiệt Dịch Sốt Xuất Huyết',
    tagline: 'Thu thập dữ liệu ca bệnh từ trạm y tế, dự báo ổ dịch kết hợp thời tiết và mật độ muỗi',
    description: 'Nền tảng y tế công cộng thu thập và phân tích dữ liệu ca bệnh sốt xuất huyết từ các trạm y tế và bệnh viện. Ứng dụng thuật toán dự đoán dịch bệnh dựa trên dữ liệu bệnh nhân, điều kiện thời tiết (nhiệt độ, lượng mưa) và mật độ muỗi.',
    category: 'tools',
    coverGradient: 'from-rose-950 via-red-950 to-slate-950',
    tags: ['PHP / Laravel', 'Python Prediction', 'Redis', 'Heatmap GIS', 'Docker'],
    techStack: ['PHP / Laravel', 'MySQL', 'Redis', 'Python (Prediction Algorithms)', 'Docker', 'RESTful APIs'],
    metrics: [
      { label: 'Độ Chính Xác Dự Báo', value: '89.4%' },
      { label: 'Bản Đồ Nhiệt Nguy Cơ', value: 'Thời Gian Thực' },
      { label: 'Cơ Sở Y Tế Kết Nối', value: '120+ Trạm' },
    ],
    featured: false,
    architectureHighlights: [
      'Dashboard trực quan hiển thị bản đồ nhiệt (Heatmap) mức độ nguy cơ theo từng khu vực phường/xã',
      'Hệ thống tự động phát cảnh báo sớm cho cơ quan quản lý khi chỉ số mật độ muỗi và ca bệnh vượt ngưỡng an toàn',
      'API bảo mật cao phục vụ ứng dụng di động cho cán bộ y tế cơ sở cập nhật ca bệnh tại chỗ',
      'Thuật toán học máy tương quan dữ liệu khí hậu thời gian thực với chu kỳ sinh trưởng của muỗi truyền bệnh'
    ],
    midnightFact: 'Thuật toán dự báo đã giúp ngành y tế dự đoán chính xác ổ dịch sớm hơn 14 ngày so với phương pháp thống kê thủ công.'
  },
  {
    id: 'streaming-platform-transcoding',
    title: 'AsiaStream — Nền Tảng Chuyển Mã Video Tải Cao & Adaptive Bitrate Streaming',
    tagline: 'Transcoding tự động đa độ phân giải FFmpeg, HLS/DASH streaming và Laravel API Gateway',
    description: 'Hệ thống xử lý và phân phối truyền hình trực tuyến và video theo yêu cầu (VOD). Tự động chuyển mã video sang nhiều độ phân giải, phát trực tuyến thích ứng băng thông (Adaptive Bitrate HLS/DASH) và tích hợp mạng phân phối nội dung CDN.',
    category: 'creative',
    coverGradient: 'from-teal-950 via-slate-900 to-midnight-950',
    tags: ['PHP / Laravel', 'FFmpeg', 'HLS / DASH', 'RabbitMQ', 'Redis', 'CDN'],
    techStack: ['PHP / Laravel', 'FFmpeg Transcoder', 'Redis Queue', 'RabbitMQ', 'MySQL', 'Nginx RTMP / HLS'],
    metrics: [
      { label: 'Tốc Độ Transcode', value: 'Realtime Hardware' },
      { label: 'Băng Thông Tiết Kiệm', value: '42%' },
      { label: 'CCU Đồng Thời', value: '80,000+' },
    ],
    featured: false,
    architectureHighlights: [
      'Pipeline chuyển mã video tự động đa độ phân giải (1080p, 720p, 480p, 360p) với bộ lọc tối ưu bitrate thích ứng',
      'API Gateway xây dựng trên Laravel kiểm soát xác thực token người dùng, phân quyền gói cước và chống ddos rate-limiting',
      'Tích hợp CDN đa tầng tối ưu chi phí lưu trữ và truyền tải dữ liệu đa vùng',
      'Hệ thống hàng đợi phân tán RabbitMQ đảm bảo phân tải transcoding đồng đều giữa các node GPU worker'
    ],
    midnightFact: 'Duy trì luồng live stream trận chung kết thể thao với hơn 80,000 người xem đồng thời lúc nửa đêm mà không rớt một khung hình.'
  }
];
