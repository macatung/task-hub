export interface DhammapadaVerse {
  verse_number: number;
  chapter_vi: string;
  chapter_pali: string;
  pali: string;
  vietnamese: string;
  insight: string;
}

export const DHAMMAPADA_VERSES: DhammapadaVerse[] = [
  {
    verse_number: 1,
    chapter_vi: 'Phẩm Song Yếu',
    chapter_pali: 'Yamakavagga',
    pali: 'Manopubbaṅgamā dhammā, manosseṭṭhā manomayā;\nManasā ce paduṭṭhena, bhāsati vā karoti vā;\nTato naṃ dukkhamanveti, cakkaṃva vahato padaṃ.',
    vietnamese: 'Ý dẫn đầu các pháp,\nÝ làm chủ, ý tạo;\nNếu với ý ô nhiễm,\nNói lên hay hành động,\nKhổ não bước theo sau,\nNhư xe chân vật kéo.',
    insight: 'Tâm ý là cội nguồn của mọi khổ đau. Giữ tâm không vấy bẩn để thoát khỏi nghiệp báo luân hồi.',
  },
  {
    verse_number: 2,
    chapter_vi: 'Phẩm Song Yếu',
    chapter_pali: 'Yamakavagga',
    pali: 'Manopubbaṅgamā dhammā, manosseṭṭhā manomayā;\nManasā ce pasannena, bhāsati vā karoti vā;\nTato naṃ sukhamanveti, chāyāva anapāyinī.',
    vietnamese: 'Ý dẫn đầu các pháp,\nÝ làm chủ, ý tạo;\nNếu với ý thanh tịnh,\nNói lên hay hành động,\nAn lạc bước theo sau,\nNhư bóng không rời hình.',
    insight: 'Mỗi suy nghĩ thanh tịnh gieo mầm cho quả phúc và sự an lạc nội tâm vững chãi.',
  },
  {
    verse_number: 5,
    chapter_vi: 'Phẩm Song Yếu',
    chapter_pali: 'Yamakavagga',
    pali: 'Na hi verena verāni, sammantīdha kudācanaṃ;\nAverena ca sammanti, esa dhammo sanantano.',
    vietnamese: 'Hận thù diệt hận thù,\nĐời này không thể có;\nTừ bi diệt hận thù,\nLà định luật ngàn thu.',
    insight: 'Tâm Từ (Mettā) là liều thuốc duy nhất dập tắt lửa sân hận và kiến tạo hòa hợp.',
  },
  {
    verse_number: 21,
    chapter_vi: 'Phẩm Không Phóng Dật',
    chapter_pali: 'Appamādavagga',
    pali: 'Appamādo amatapadaṃ, pamādo maccuno padaṃ;\nAppamattā na mīyanti, ye pamattā yathā matā.',
    vietnamese: 'Không phóng dật: đường sống,\nPhóng dật: đường tử vong;\nNgười không phóng dật: sống,\nKẻ phóng dật: như chết.',
    insight: 'Chánh niệm tỉnh giác trong từng giây phút là cánh cửa dẫn tới bất tử Niết-bàn.',
  },
  {
    verse_number: 103,
    chapter_vi: 'Phẩm Ngàn',
    chapter_pali: 'Sahassavagga',
    pali: 'Yo sahassaṃ sahassena, saṅgāme mānuse jine;\nEkañca jeyyamattānaṃ, sa ve saṅgāmajuttamo.',
    vietnamese: 'Dầu tại bãi chiến trường,\nThắng hàng ngàn quân địch;\nKhông bằng tự thắng mình,\nChiến công ấy tối thượng.',
    insight: 'Chiến thắng vĩ đại nhất của bậc trượng phu là điều phục và làm chủ chính tâm thức mình.',
  },
  {
    verse_number: 183,
    chapter_vi: 'Phẩm Phật Đà',
    chapter_pali: 'Buddhavagga',
    pali: 'Sabbapāpassa akaraṇaṃ, kusalassa upasampadā;\nSacittapariyodapanaṃ, etaṃ buddhāna sāsanaṃ.',
    vietnamese: 'Không làm mọi điều ác,\nThành tựu các hạnh lành;\nGiữ tâm ý trong sạch,\nĐó lời chư Phật dạy.',
    insight: 'Lời giáo huấn cốt tủy của muôn ngàn chư Phật: Dứt ác, Làm lành, Thanh lọc tâm.',
  },
  {
    verse_number: 277,
    chapter_vi: 'Phẩm Đạo',
    chapter_pali: 'Maggavagga',
    pali: 'Sabbe saṅkhārā aniccāti, yadā paññāya passati;\nAtha nibbindatī dukkhe, esa maggo visuddhiyā.',
    vietnamese: 'Tất cả hành vô thường,\nVới tuệ quán thấy vậy;\nNhờ thế thoát khổ đau,\nLà con đường thanh tịnh.',
    insight: 'Quán chiếu tính sinh diệt của vạn pháp giúp tâm buông xả bám víu và tự tại trước đổi thay.',
  },
];

export interface HealthReminder {
  id: string;
  type: 'water' | 'eye' | 'stretch' | 'breathe';
  title: string;
  message: string;
  icon: string;
}

export const HEALTH_REMINDERS: HealthReminder[] = [
  {
    id: 'breathe-1',
    type: 'breathe',
    title: 'Hít Thở Chánh Niệm 🧘',
    message: 'Tạm dừng tay trong giây lát. Hít vào thật sâu cảm nhận sự bình an, thở ra nhẹ nhàng mỉm cười.',
    icon: '🌸',
  },
  {
    id: 'water-1',
    type: 'water',
    title: 'Bổ Sung Nước Cho Thân Thể 💧',
    message: 'Uống một ngụm nước ấm trong chánh niệm. Cảm nhận dòng nước mát lành nuôi dưỡng từng tế bào.',
    icon: '💧',
  },
  {
    id: 'eye-1',
    type: 'eye',
    title: 'Thư Giãn Đôi Mắt 👀',
    message: 'Nhìn xa khoảng 6 mét trong 20 giây hoặc nhắm mắt lại để đôi mắt quý giá được nghỉ ngơi.',
    icon: '🌿',
  },
  {
    id: 'stretch-1',
    type: 'stretch',
    title: 'Thả Lỏng Cột Sống & Vai Gáy 🧘‍♂️',
    message: 'Vươn vai nhẹ nhàng, xoay nhẹ khớp cổ và giữ thẳng lưng để dòng năng lượng lưu thông thông suốt.',
    icon: '⚡',
  },
];
