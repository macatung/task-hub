<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Skill;
use App\Models\Experience;
use App\Models\Article;
use App\Models\SiteSetting;
use App\Models\PageView;
use App\Models\AnalyticsEvent;
use Carbon\Carbon;

class ContentAndAnalyticsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Skills
        $skills = [
            // AI Agents & LLM Architecture
            ['name' => 'Multi-Agent Orchestration', 'category' => 'ai', 'level' => 96, 'rune' => '🤖', 'tag' => 'Core AI', 'order' => 1],
            ['name' => 'Tool & Function Calling', 'category' => 'ai', 'level' => 98, 'rune' => '⚡', 'tag' => 'Automation', 'order' => 2],
            ['name' => 'RAG & Vector Databases', 'category' => 'ai', 'level' => 94, 'rune' => '🧠', 'tag' => 'GenAI', 'order' => 3],
            ['name' => 'Google Gemini & OpenAI APIs', 'category' => 'ai', 'level' => 96, 'rune' => '🔮', 'tag' => 'LLM APIs', 'order' => 4],
            ['name' => 'Python (FastAPI / LangChain)', 'category' => 'ai', 'level' => 92, 'rune' => '🐍', 'tag' => 'AI Backend', 'order' => 5],

            // Backend Mastery & Architecture
            ['name' => 'PHP 8.3+ & Laravel 11/12', 'category' => 'backend', 'level' => 98, 'rune' => '🐘', 'tag' => 'Architecture', 'order' => 6],
            ['name' => 'Filament Admin 3 & Livewire 3', 'category' => 'backend', 'level' => 95, 'rune' => '⚡', 'tag' => 'Admin UI', 'order' => 7],
            ['name' => 'Redis Caching & Atomic Locks', 'category' => 'backend', 'level' => 96, 'rune' => '⚡', 'tag' => 'High-Load', 'order' => 8],
            ['name' => 'RabbitMQ & Message Queues', 'category' => 'backend', 'level' => 94, 'rune' => '🐇', 'tag' => 'Queue', 'order' => 9],
            ['name' => 'PostgreSQL & MySQL Indexing', 'category' => 'backend', 'level' => 95, 'rune' => '🗄️', 'tag' => 'Database', 'order' => 10],

            // Telecom, GIS & Specialized Infra
            ['name' => 'GIS & Spatial Data (QGIS)', 'category' => 'cloud', 'level' => 92, 'rune' => '🗺️', 'tag' => 'Spatial', 'order' => 11],
            ['name' => 'NMS & Telecom Protocols (SNMP)', 'category' => 'cloud', 'level' => 90, 'rune' => '📡', 'tag' => 'Protocols', 'order' => 12],
            ['name' => 'Elasticsearch & Log Analytics', 'category' => 'cloud', 'level' => 92, 'rune' => '🔍', 'tag' => 'Big Data', 'order' => 13],
            ['name' => 'Video Transcoding (FFmpeg / HLS)', 'category' => 'frontend', 'level' => 93, 'rune' => '🎬', 'tag' => 'Streaming', 'order' => 14],

            // Frontend & DevOps
            ['name' => 'Vue 3 & ReactJS / React Native', 'category' => 'frontend', 'level' => 94, 'rune' => '⚛️', 'tag' => 'Frontend', 'order' => 15],
            ['name' => 'TypeScript Strict & TailwindCSS', 'category' => 'frontend', 'level' => 95, 'rune' => '📘', 'tag' => 'Type-Safe', 'order' => 16],
            ['name' => 'Docker & Microservices', 'category' => 'cloud', 'level' => 93, 'rune' => '🐳', 'tag' => 'Containers', 'order' => 17],
            ['name' => 'CI/CD GitHub Actions & Cloudflare', 'category' => 'cloud', 'level' => 92, 'rune' => '🌐', 'tag' => 'DevOps', 'order' => 18],
        ];

        foreach ($skills as $s) {
            Skill::updateOrCreate(['name' => $s['name']], $s);
        }

        // 2. Seed Experiences
        $experiences = [
            [
                'role' => 'Lead AI Agent & Autonomous Systems Architect',
                'company' => 'Enterprise AI & Automation Solutions',
                'period' => '2025 — Hiện Tại',
                'type' => 'Full-time',
                'location' => 'Remote / Global',
                'summary' => 'Thiết kế và triển khai hệ thống Multi-Agent AI tự trị thay thế toàn diện đội ngũ Customer Service 24/7, tích hợp RAG, Function Calling, CRM/Telegram/Zalo webhook và tự động giải quyết tranh chấp hoàn tiền.',
                'achievements' => [
                    'Xây dựng Multi-Agent CS giải quyết tự động > 92% khiếu nại khách hàng, giảm 85% chi phí vận hành nhân sự CS.',
                    'Tích hợp Tool/Function Calling với API ERP/Database tra cứu đơn hàng, tự động đối soát và hoàn tiền với độ trễ < 1.2s.',
                    'Triển khai hệ thống RAG thời gian thực với Vector Database, tự động cập nhật tri thức sản phẩm & chính sách bảo hành mới nhất.'
                ],
                'technologies' => ['Multi-Agent Orchestration', 'Google Gemini AI', 'OpenAI', 'Python / FastAPI', 'Laravel 12', 'Redis Queue', 'Vector DB'],
                'order' => 1,
            ],
            [
                'role' => 'Fullstack Developer & Senior Systems Architect',
                'company' => 'Telecom Infrastructure & GIS Technologies',
                'period' => '02/2022 — 06/2025',
                'type' => 'Full-time',
                'location' => 'Ho Chi Minh City',
                'summary' => 'Chủ trì thiết kế và phát triển các hệ thống hạ tầng viễn thông, số hóa mạng lưới cáp quang toàn quốc (GIS/QGIS), hệ thống giám sát thiết bị truyền dẫn (NMS), hệ thống cảnh báo sớm dịch bệnh sốt xuất huyết và quản lý địa chỉ IP.',
                'achievements' => [
                    'Xây dựng hệ thống GIS số hóa mạng cáp quang toàn quốc, tích hợp QGIS phân tích dữ liệu không gian và tự động định tuyến cáp tối ưu.',
                    'Phát triển Network Management System (NMS) giám sát thời gian thực thiết bị truyền dẫn SDH/DWDM qua SNMP/Telnet/SSH với cảnh báo dị thường Machine Learning.',
                    'Xây dựng hệ thống cảnh báo sớm dịch sốt xuất huyết kết hợp bản đồ nhiệt Heatmap và thuật toán dự báo theo thời tiết/mật độ muỗi.',
                    'Phát triển hệ thống IP Management tính toán subnet tự động, quản lý phân cấp IP quy mô lớn trên Laravel + Filament Admin.'
                ],
                'technologies' => ['PHP / Laravel', 'Filament Admin', 'Node.js', 'Python (Data/ML)', 'Elasticsearch', 'MySQL', 'Redis', 'RabbitMQ', 'ReactJS', 'QGIS / Spatial GIS', 'SNMP'],
                'order' => 2,
            ],
            [
                'role' => 'Backend Web Developer & Streaming Engineer',
                'company' => 'Media & High-Throughput Streaming Corporation',
                'period' => '06/2017 — 01/2022',
                'type' => 'Full-time',
                'location' => 'Ho Chi Minh City',
                'summary' => 'Kiến trúc nền tảng xử lý và phân phối media/video streaming tải cao, chuyển mã tự động đa độ phân giải và cổng API Gateway bảo mật.',
                'achievements' => [
                    'Xây dựng pipeline chuyển mã video tự động đa độ phân giải (FFmpeg) và phát trực tuyến thích ứng Adaptive Bitrate Streaming (HLS/DASH).',
                    'Tích hợp CDN đa tầng tối ưu hóa chi phí băng thông 42% và thời gian tải đệm video xuống sub-second.',
                    'Phát triển Laravel API Gateway chịu tải xác thực, phân quyền và rate-limiting hàng triệu requests mỗi ngày với Redis & RabbitMQ.'
                ],
                'technologies' => ['PHP / Laravel', 'FFmpeg', 'Redis', 'RabbitMQ', 'MySQL', 'Nginx', 'HLS/DASH Streaming', 'Docker'],
                'order' => 3,
            ],
            [
                'role' => 'National Informatics Prodigy & Software Engineer',
                'company' => 'National Informatics Olympiad & CS Academy',
                'period' => '2013 — 2018',
                'type' => 'Education & Awards',
                'location' => 'Ho Chi Minh City',
                'summary' => 'Đoạt giải Khuyến khích Quốc gia môn Tin học, rèn giũa nền tảng thuật toán chuyên sâu, cấu trúc dữ liệu, tư duy hệ thống và văn hóa gõ code xuyên đêm.',
                'achievements' => [
                    'Đạt Giải Khuyến khích Quốc gia môn Tin học (National Informatics Incentive Award).',
                    '2 năm liên tiếp đạt Giải Nhì Tin học Cấp Tỉnh (2012 & 2013).',
                    'Tốt nghiệp xuất sắc chuyên ngành Công Nghệ Thông Tin & Kỹ Thuật Phần Mềm.'
                ],
                'technologies' => ['C/C++', 'Algorithms & Data Structures', 'Linux', 'Git', 'PHP', 'MySQL'],
                'order' => 4,
            ]
        ];

        foreach ($experiences as $exp) {
            Experience::updateOrCreate(['role' => $exp['role'], 'company' => $exp['company']], $exp);
        }

        // 3. Seed Articles / Midnight Tech Notes
        $articles = [
            [
                'title' => 'Kiến Trúc Multi-Agent AI Tự Trị Thay Thế 100% Customer Service 24/7',
                'slug' => 'kien-truc-multi-agent-ai-customer-service',
                'excerpt' => 'Cách phân rã Router Agent, Database Lookup Agent và Policy Auditor để tự động hóa quy trình xử lý khiếu nại và hoàn tiền với độ chính xác > 92%.',
                'content' => "## 1. Tại sao Single LLM thất bại trong Customer Service phức tạp?\n\nMột chatbot LLM thông thường chỉ có thể sinh text trả lời chung chung. Để thay thế hoàn toàn nhân sự CS trong môi trường thực chiến, hệ thống phải vừa có khả năng suy luận, vừa có quyền hạn gọi các công cụ (Tool / Function Calling) tra cứu dữ liệu khách hàng theo thời gian thực và tuân thủ các quy tắc an toàn bảo mật nghiêm ngặt.\n\n```mermaid\ngraph TD\n    A[Khách hàng / Webhook] --> B[Router Agent]\n    B -->|Tra cứu đơn hàng| C[ERP Database Agent]\n    B -->|Khiếu nại / Đổi trả| D[Policy Auditor Agent]\n    C --> E[Xác thực trạng thái đơn]\n    D --> F[Tính toán số tiền hoàn & Gọi Payment Gateway]\n    D -->|Rủi ro cao| G[Human in the Loop Escalate]\n```\n\n## 2. Kiến trúc 3 tầng Multi-Agent Orchestration\n\n1. **Router Agent (Phân Luồng Ý Định)**: Phân loại ý định khách hàng (Tra cứu đơn hàng, Báo lỗi sản phẩm, Yêu cầu hoàn tiền, Đổi địa chỉ nhận).\n2. **Database Lookup Agent (Tra Cứu Dữ Liệu)**: Thực hiện Tool Calling gọi REST API hoặc SQL Read-Only với ERP nội bộ để lấy trạng thái vận chuyển và lịch sử thanh toán với độ trễ < 1.2s.\n3. **Policy & Refund Auditor Agent (Kiểm Toán & Hoàn Tiền)**: Đối soát các điều kiện bảo hành, tính toán khấu trừ và gọi API cổng thanh toán SePay / VNPay IPN để hoàn tiền tự động mà không cần can thiệp thủ công.\n\n### Kết quả thực chiến:\n- Tỉ lệ giải quyết khiếu nại tự động: **> 92%**\n- Thời gian phản hồi trung bình: **< 1.2 giây**\n- Tiết kiệm **85%** chi phí vận hành nhân sự CS ca đêm.",
                'tags' => ['AI Agents', 'Multi-Agent', 'GenAI', 'Customer Service', 'Laravel 12'],
                'reading_time_min' => 6,
                'is_published' => true,
                'published_at' => Carbon::now()->subDays(1),
            ],
            [
                'title' => 'Tối Ưu Cổng Định Giá Cổ Phiếu 7 Năm Với 50+ Artisan Crawlers & Gemini AI',
                'slug' => 'toi-uu-dinh-gia-co-phieu-artisan-gemini-ai',
                'excerpt' => 'Kiến trúc crawler đa luồng cào dữ liệu tài chính CafeF/SSI, tự động tính toán EPS, P/E, Safety Margin và cố vấn tài chính thông minh.',
                'content' => "## 1. Xử lý dữ liệu tài chính 7 năm trên 1,500 mã cổ phiếu\n\nĐể đảm bảo dữ liệu luôn tươi mới vào 2:00 AM mỗi ngày mà không bị nghẽn CPU hoặc dính Rate Limit IP của các sàn dữ liệu tài chính:\n\n```php\n// Phân tán Artisan Crawlers qua Redis Queue với Atomic Locks\nforeach (\$tickerList as \$ticker) {\n    CrawlFinancialReportJob::dispatch(\$ticker)\n        ->onQueue('high_priority_crawlers')\n        ->delay(now()->addSeconds(rand(1, 15)));\n}\n```\n\n## 2. Tích Hợp Google Gemini AI Cố Vấn Đầu Tư\n\nKết hợp Gemini AI Function Calling để phân tích báo cáo tài chính, phát hiện doanh thu bất thường, tính toán hệ số P/E, định giá Benjamin Graham và xuất cảnh báo tức thì khi có biến động bất thường.",
                'tags' => ['Laravel 12', 'Filament 3', 'Gemini AI', 'Finance', 'Redis Queue'],
                'reading_time_min' => 5,
                'is_published' => true,
                'published_at' => Carbon::now()->subDays(3),
            ],
            [
                'title' => 'Số Hóa 500,000+ Điểm Nút Mạng Cáp Quang Toàn Quốc Với QGIS & PostGIS',
                'slug' => 'so-hoa-mang-cap-quang-toan-quoc-qgis-postgis',
                'excerpt' => 'Cách xây dựng hệ thống GIS định tuyến tuyến cáp quang tối ưu và hiển thị bản đồ địa không gian 60 FPS trên 500k điểm nút.',
                'content' => "## 1. Bài toán địa lý không gian trong hạ tầng viễn thông\n\nQuản lý hàng trăm ngàn kilômét cáp quang, hố ga, tủ cáp, măng xông và từng sợi quang đòi hỏi cấu trúc dữ liệu không gian PostGIS chuẩn hóa kết hợp cùng Spatial Indexing (GIST Index).\n\n```sql\n-- Tối ưu hóa truy vấn tìm hố ga và mối hàn gần nhất\nSELECT id, name, ST_Distance(geom, ST_SetSRID(ST_Point(106.660172, 10.762622), 4326)) AS distance\nFROM fiber_manholes\nWHERE ST_DWithin(geom, ST_SetSRID(ST_Point(106.660172, 10.762622), 4326), 500)\nORDER BY distance ASC\nLIMIT 5;\n```\n\n## 2. Thuật Toán Định Tuyến Tuyến Kéo Cáp Tối Ưu\n\nSử dụng thuật toán Dijkstra tối ưu hóa trên đồ thị mạng lưới kết hợp trọng số địa hình và dung lượng cổng trống, giúp thời gian tính toán tuyến cáp giảm từ **12s** xuống **< 180ms**.",
                'tags' => ['GIS / Spatial', 'QGIS', 'PostgreSQL', 'PostGIS', 'Telecom'],
                'reading_time_min' => 7,
                'is_published' => true,
                'published_at' => Carbon::now()->subDays(6),
            ],
            [
                'title' => 'Giám Sát Hạ Tầng Truyền Dẫn SDH/DWDM Thời Gian Thực Bằng NMS & ML',
                'slug' => 'giam-sat-ha-tang-truyen-dan-sdh-dwdm-nms-ml',
                'excerpt' => 'Xử lý hàng triệu bản tin SNMP/log mỗi phút qua RabbitMQ & Elasticsearch và mô hình học máy dự báo sự cố sụt áp trước 30 phút.',
                'content' => "## 1. NMS Matrix: Kiến trúc chịu tải cao cho thiết bị truyền dẫn\n\nHạ tầng viễn thông cốt lõi (SDH/DWDM) yêu cầu chỉ số sẵn sàng 99.999% (Five Nines). Hệ thống NMS Matrix liên tục thu thập telemetry qua SNMP v2c/v3, Telnet và SSH.\n\n```python\n# Mô hình phát hiện suy hao quang học bất thường (Optical Power Attenuation)\ndef predict_fiber_degradation(telemetry_stream):\n    anomaly_score = ml_model.score_samples(telemetry_stream)\n    if anomaly_score < ANOMALY_THRESHOLD:\n        trigger_early_warning_alert(severity='CRITICAL', eta_to_failure='30m')\n```\n\n## 2. Kết nối phân tán qua RabbitMQ & Elasticsearch\n\nPhân tải hơn **100,000 bản tin telemetry/giây** qua cụm RabbitMQ worker và đánh chỉ mục Elasticsearch, giúp kỹ thuật viên tra cứu lịch sử sự cố trong vòng vài mili-giây.",
                'tags' => ['NMS', 'Telecom', 'Elasticsearch', 'RabbitMQ', 'Machine Learning'],
                'reading_time_min' => 8,
                'is_published' => true,
                'published_at' => Carbon::now()->subDays(10),
            ]
        ];

        foreach ($articles as $art) {
            Article::updateOrCreate(['slug' => $art['slug']], $art);
        }

        // 4. Seed Site Settings
        $settings = [
            'site_name' => 'macatung.dev',
            'site_title' => 'macatung.dev — Senior Fullstack & AI Agent Architect',
            'slogan' => 'Code at midnight',
            'hero_subtitle' => 'Senior Backend / Fullstack Developer & AI Agent Architect với 8+ năm thực chiến. Chuyên sâu kiến trúc Multi-Agent AI tự trị, hạ tầng viễn thông GIS/NMS và hệ thống web phân tán tải cao.',
            'contact_email' => 'dev@macatung.dev',
            'contact_phone' => '',
            'contact_address' => 'Ho Chi Minh City / Remote',
            'telegram_username' => '@macatung_dev',
            'github_url' => 'https://github.com/macatung',
            'linkedin_url' => 'https://linkedin.com',
            'resume_download_url' => '/brand/macatung-logo-horizontal.png',
            'seo_description' => 'Portfolio chính thức của Ma Cà Tưng — Senior Backend / Fullstack Developer & AI Agent Architect (macatung.dev).',
            'admin_password' => 'macatung@midnight2026',
        ];

        foreach ($settings as $key => $val) {
            SiteSetting::set($key, $val, 'Cấu hình hệ thống');
        }
    }
}
