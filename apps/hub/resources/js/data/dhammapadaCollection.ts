export interface DhammapadaVerse {
  id: number;
  verse_number: number;
  chapter_pali: string;
  chapter_vi: string;
  pali: string;
  vietnamese: string;
  insight: string;
}

export const DHAMMAPADA_VERSES: DhammapadaVerse[] = [
  {
    id: 1,
    verse_number: 1,
    chapter_pali: 'Yamakavagga',
    chapter_vi: 'Phẩm Song Yếu',
    pali: 'Manopubbaṅgamā dhammā, manoseṭṭhā manomayā;\nManasā ce paduṭṭhena, bhāsati vā karoti vā;\nTato naṃ dukkhamanveti, cakkaṃva vahato padaṃ.',
    vietnamese: 'Ý dẫn đầu các pháp,\nÝ làm chủ, ý tạo;\nNếu với ý ô nhiễm,\nNói lên hay hành động,\nKhổ não bước theo sau,\nNhư xe chân vật kéo.',
    insight: 'Tâm ý là cội nguồn của mọi khổ đau. Giữ tâm không vấy bẩn để thoát khỏi nghiệp báo.'
  },
  {
    id: 2,
    verse_number: 2,
    chapter_pali: 'Yamakavagga',
    chapter_vi: 'Phẩm Song Yếu',
    pali: 'Manopubbaṅgamā dhammā, manoseṭṭhā manomayā;\nManasā ce pasannena, bhāsati vā karoti vā;\nTato naṃ sukhamanveti, chāyāva anapāyinī.',
    vietnamese: 'Ý dẫn đầu các pháp,\nÝ làm chủ, ý tạo;\nNếu với ý thanh tịnh,\nNói lên hay hành động,\nAn lạc bước theo sau,\nNhư bóng không rời hình.',
    insight: 'Gieo hạt giống thiện lành trong tâm ý, hoa trái an lạc sẽ mãi đồng hành như hình với bóng.'
  },
  {
    id: 3,
    verse_number: 5,
    chapter_pali: 'Yamakavagga',
    chapter_vi: 'Phẩm Song Yếu',
    pali: 'Na hi verena verāni, sammantīdha kudācanaṃ;\nAverena ca sammanti, esa dhammo sanantano.',
    vietnamese: 'Hận thù diệt hận thù,\nĐời này không thể có;\nTừ bi diệt hận thù,\nLà định luật ngàn thu.',
    insight: 'Chỉ có tình thương yêu và sự tha thứ mới có thể dập tắt ngọn lửa oán kết hận thù.'
  },
  {
    id: 4,
    verse_number: 21,
    chapter_pali: 'Appamādavagga',
    chapter_vi: 'Phẩm Không Phóng Dật',
    pali: 'Appamādo amatapadaṃ, pamādo maccuno padaṃ;\nAppamattā na mīyanti, ye pamattā yathā matā.',
    vietnamese: 'Không phóng dật: đường sống;\nPhóng dật: đường tử vong;\nKhông phóng dật: không chết;\nPhóng dật như chết rồi.',
    insight: 'Chánh niệm tỉnh giác trong hiện tại là chìa khóa mở ra cánh cửa bất tử Niết-bàn.'
  },
  {
    id: 5,
    verse_number: 50,
    chapter_pali: 'Pupphavagga',
    chapter_vi: 'Phẩm Hoa',
    pali: 'Na paresaṃ vilomāni, na paresaṃ katākataṃ;\nAttanova avekkheyya, katāni akatāni ca.',
    vietnamese: 'Không nên nhìn lỗi người,\nNgười làm hay không làm;\nNên tự nhìn chính mình,\nĐã làm hay chưa làm.',
    insight: 'Quay về quán chiếu tự tâm thay vì săm soi, chỉ trích lỗi lầm của tha nhân.'
  },
  {
    id: 6,
    verse_number: 103,
    chapter_pali: 'Sahassavagga',
    chapter_vi: 'Phẩm Ngàn',
    pali: 'Yo sahassaṃ sahassena, saṅgāme mānuse jine;\nEkañca jeyyamattānaṃ, sa ve saṅgāmajuttamo.',
    vietnamese: 'Dù tại bãi chiến trường,\nThắng ngàn vạn quân địch;\nKhông bằng tự thắng mình,\nChiến công ấy oanh liệt.',
    insight: 'Chiến thắng lớn nhất trong cõi đời là chiến thắng được tâm tham, sân, si của chính bản thân.'
  },
  {
    id: 7,
    verse_number: 183,
    chapter_pali: 'Buddhavagga',
    chapter_vi: 'Phẩm Phật Đà',
    pali: 'Sabbapāpassa akaraṇaṃ, kusalassa upasampadā;\nSacittapariyodapanaṃ, etaṃ buddhāna sāsanaṃ.',
    vietnamese: 'Không làm mọi điều ác,\nThành tựu các hạnh lành,\nGiữ tâm ý trong sạch,\nĐó lời chư Phật dạy.',
    insight: 'Ba nguyên lý cốt lõi tinh hoa của tất cả mười phương Chư Phật trong ba đời.'
  },
  {
    id: 8,
    verse_number: 277,
    chapter_pali: 'Maggavagga',
    chapter_vi: 'Phẩm Đạo',
    pali: 'Sabbe saṅkhārā aniccāti, yadā paññāya passati;\nAtha nibbindati dukkhe, esa maggo visuddhiyā.',
    vietnamese: 'Tất cả hành vô thường,\nVới tuệ quán thấy vậy;\nĐau khổ liền dứt trừ,\nĐó con đường thanh tịnh.',
    insight: 'Thấy rõ thực tướng biến dịch của vạn vật sẽ buông bỏ mọi luyến ái và khổ não.'
  },
  {
    id: 9,
    verse_number: 278,
    chapter_pali: 'Maggavagga',
    chapter_vi: 'Phẩm Đạo',
    pali: 'Sabbe saṅkhārā dukkhāti, yadā paññāya passati;\nAtha nibbindati dukkhe, esa maggo visuddhiyā.',
    vietnamese: 'Tất cả hành là khổ,\nVới tuệ quán thấy vậy;\nĐau khổ liền dứt trừ,\nĐó con đường thanh tịnh.',
    insight: 'Thấu hiểu bản chất bất toàn của pháp hữu vi để hướng tâm về chốn tịch tịnh Niết-bàn.'
  },
  {
    id: 10,
    verse_number: 279,
    chapter_pali: 'Maggavagga',
    chapter_vi: 'Phẩm Đạo',
    pali: 'Sabbe dhammā anattāti, yadā paññāya passati;\nAtha nibbindati dukkhe, esa maggo visuddhiyā.',
    vietnamese: 'Tất cả pháp vô ngã,\nVới tuệ quán thấy vậy;\nĐau khổ liền dứt trừ,\nĐó con đường thanh tịnh.',
    insight: 'Không có cái tôi hay ngã chấp nào tồn tại độc lập, giải thoát hoàn toàn khỏi ngục tù ngã mạn.'
  }
];
