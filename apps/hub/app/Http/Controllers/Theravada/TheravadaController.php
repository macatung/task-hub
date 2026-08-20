<?php

namespace App\Http\Controllers\Theravada;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TheravadaController extends Controller
{
    /**
     * Daily Dhammapada Verses Collection
     */
    protected array $dhammapadaVerses = [
        [
            'verse_number' => 1,
            'pali' => 'Manopubbaṅgamā dhammā, manoseṭṭhā manomayā; Manasā ce paduṭṭhena, bhāsati vā karoti vā; Tato naṃ dukkhamanveti, cakkaṃva vahato padaṃ.',
            'vietnamese' => 'Ý dẫn đầu các pháp, Ý làm chủ, ý tạo; Nếu với ý ô nhiễm, Nói lên hay hành động, Khổ não bước theo sau, Như xe chân vật kéo.',
            'chapter' => 'Phẩm Song Yếu (Yamakavagga)'
        ],
        [
            'verse_number' => 2,
            'pali' => 'Manopubbaṅgamā dhammā, manoseṭṭhā manomayā; Manasā ce pasannena, bhāsati vā karoti vā; Tato naṃ sukhamanveti, chāyāva anapāyinī.',
            'vietnamese' => 'Ý dẫn đầu các pháp, Ý làm chủ, ý tạo; Nếu với ý thanh tịnh, Nói lên hay hành động, An lạc bước theo sau, Như bóng không rời hình.',
            'chapter' => 'Phẩm Song Yếu (Yamakavagga)'
        ],
        [
            'verse_number' => 5,
            'pali' => 'Na hi verena verāni, sammantīdha kudācanaṃ; Averena ca sammanti, esa dhammo sanantano.',
            'vietnamese' => 'Hận thù diệt hận thù, Đời này không thể có; Từ bi diệt hận thù, Là định luật ngàn thu.',
            'chapter' => 'Phẩm Song Yếu (Yamakavagga)'
        ],
        [
            'verse_number' => 21,
            'pali' => 'Appamādo amatapadaṃ, pamādo maccuno padaṃ; Appamattā na mīyanti, ye pamattā yathā matā.',
            'vietnamese' => 'Không phóng dật: đường sống; Phóng dật: đường tử vong; Không phóng dật: không chết; Phóng dật như chết rồi.',
            'chapter' => 'Phẩm Không Phóng Dật (Appamādavagga)'
        ],
        [
            'verse_number' => 183,
            'pali' => 'Sabbapāpassa akaraṇaṃ, kusalassa upasampadā; Sacittapariyodapanaṃ, etaṃ buddhāna sāsanaṃ.',
            'vietnamese' => 'Không làm mọi điều ác, Thành tựu các hạnh lành, Giữ tâm ý trong sạch, Chính lời chư Phật dạy.',
            'chapter' => 'Phẩm Phật Đà (Buddhavagga)'
        ],
    ];

    /**
     * Theravada Home
     */
    public function index(): Response
    {
        $articles = Article::query()
            ->where('site_domain', 'theravada')
            ->where('is_published', true)
            ->orderBy('published_at', 'desc')
            ->get();

        // Pick verse of the day based on day of year
        $dayOfYear = (int) date('z');
        $dailyVerse = $this->dhammapadaVerses[$dayOfYear % count($this->dhammapadaVerses)];

        $categories = [
            [
                'slug' => 'phap-hoc',
                'name' => 'Pháp Học (Pariyatti)',
                'pali' => 'Pariyatti Dhamma',
                'description' => 'Khảo cứu Tam Tạng Pāḷi, Tứ Thánh Đế, Bát Chánh Đạo, Thập Nhị Duyên Khởi và giáo lý uyên áo.',
                'icon' => 'BookOpen',
                'count' => $articles->where('category', 'phap-hoc')->count()
            ],
            [
                'slug' => 'phap-hanh',
                'name' => 'Pháp Hành (Paṭipatti)',
                'pali' => 'Paṭipatti Dhamma',
                'description' => 'Thực hành Thiền Tứ Niệm Xứ (Satipaṭṭhāna), Minh Sát Tuệ Vipassanā và Chánh niệm đời sống.',
                'icon' => 'Activity',
                'count' => $articles->where('category', 'phap-hanh')->count()
            ],
            [
                'slug' => 'kinh-tung',
                'name' => 'Kinh Tụng & Paritta',
                'pali' => 'Sutta & Paritta',
                'description' => 'Các bản kinh hộ trì Pāḷi — Việt thiêng liêng: Kinh Chuyển Pháp Luân, Kinh Từ Bi, Kinh Châu Báu.',
                'icon' => 'Compass',
                'count' => $articles->where('category', 'kinh-tung')->count()
            ],
        ];

        return Inertia::render('Theravada/Index', [
            'articles' => $articles,
            'dailyVerse' => $dailyVerse,
            'categories' => $categories,
            'title' => 'Ma Tọa Thiền — Phật Giáo Nguyên Thủy & Thiền Vipassanā',
        ]);
    }

    /**
     * Show Article / Sutta
     */
    public function show(string $slug): Response
    {
        $article = Article::query()
            ->where('site_domain', 'theravada')
            ->where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();

        $related = Article::query()
            ->where('site_domain', 'theravada')
            ->where('is_published', true)
            ->where('id', '!=', $article->id)
            ->latest('published_at')
            ->take(3)
            ->get();

        return Inertia::render('Theravada/Show', [
            'article' => $article,
            'related' => $related,
            'title' => "{$article->title} — Ma Tọa Thiền",
        ]);
    }

    /**
     * Category Filter
     */
    public function category(string $category): Response
    {
        $articles = Article::query()
            ->where('site_domain', 'theravada')
            ->where('category', $category)
            ->where('is_published', true)
            ->orderBy('published_at', 'desc')
            ->get();

        $categoryNames = [
            'phap-hoc' => 'Pháp Học (Pariyatti)',
            'phap-hanh' => 'Pháp Hành (Paṭipatti — Vipassanā)',
            'kinh-tung' => 'Tam Tạng & Kinh Tụng Pāḷi (Sutta)',
        ];

        return Inertia::render('Theravada/Category', [
            'categorySlug' => $category,
            'categoryName' => $categoryNames[$category] ?? ucfirst($category),
            'articles' => $articles,
            'title' => ($categoryNames[$category] ?? ucfirst($category)) . ' — Ma Tọa Thiền',
        ]);
    }

    /**
     * Pali Glossary Page
     */
    public function glossary(): Response
    {
        return Inertia::render('Theravada/Glossary', [
            'title' => 'Từ Điển Thuật Ngữ Phật Học Pāḷi — Ma Tọa Thiền',
        ]);
    }

    /**
     * Buddhist Interactive Apps Hub
     */
    public function apps(): Response
    {
        return Inertia::render('Theravada/Apps', [
            'title' => 'Ứng Dụng Pháp Bảo & Tọa Thiền Chánh Niệm — Ma Tọa Thiền',
        ]);
    }
}
