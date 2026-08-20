export interface PaliGlossaryEntry {
  term: string;
  pali: string;
  vietnamese: string;
  category: string;
  definition: string;
  aliases?: string[];
}

export const PALI_GLOSSARY: PaliGlossaryEntry[] = [
  // 1. Tứ Thánh Đế
  {
    term: 'Dukkha',
    pali: 'Dukkha',
    vietnamese: 'Khổ Đế / Khổ não / Bất toàn',
    category: 'Tứ Thánh Đế',
    definition: 'Chân lý thứ nhất trong Tứ Thánh Đế: Bản chất bất toàn, xung đột, biến dịch và không thể đem lại sự thỏa mãn vĩnh viễn của toàn bộ đời sống hữu vi.',
    aliases: ['Khổ đế', 'Dukkha Sacca', 'Khổ tính']
  },
  {
    term: 'Samudaya',
    pali: 'Samudaya',
    vietnamese: 'Tập Đế / Nguồn gốc của Khổ',
    category: 'Tứ Thánh Đế',
    definition: 'Chân lý thứ hai: Nguyên nhân sinh khởi mọi khổ đau luân hồi chính là Ái dục (Taṇhā) gồm Dục ái, Hữu ái và Phi hữu ái.',
    aliases: ['Tập đế', 'Dukkhasamudaya']
  },
  {
    term: 'Nirodha',
    pali: 'Nirodha',
    vietnamese: 'Diệt Đế / Sự Chấm Dứt Khổ',
    category: 'Tứ Thánh Đế',
    definition: 'Chân lý thứ ba: Sự dập tắt hoàn toàn gốc rễ ái dục và vô minh, đạt tới cảnh giới giải thoát tuyệt đối Niết-bàn (Nibbāna).',
    aliases: ['Diệt đế', 'Dukkhanirodha']
  },
  {
    term: 'Magga',
    pali: 'Magga',
    vietnamese: 'Đạo Đế / Con Đường Thoát Khổ',
    category: 'Tứ Thánh Đế',
    definition: 'Chân lý thứ tư: Con đường dẫn đến sự tận diệt khổ đau, chính là Bát Chánh Đạo (Ariya Aṭṭhaṅgika Magga) gồm Giới - Định - Tuệ.',
    aliases: ['Đạo đế', 'Magga Sacca']
  },

  // 2. Tam Tướng (Tilakkhaṇa)
  {
    term: 'Anicca',
    pali: 'Anicca',
    vietnamese: 'Vô thường',
    category: 'Tam Tướng',
    definition: 'Đặc tính biến đổi, sinh diệt không ngừng trong từng sát-na của mọi hiện tượng hữu vi, không có bất kỳ trạng thái nào tồn tại mãi mãi.',
    aliases: ['Vô thường', 'Tính vô thường']
  },
  {
    term: 'Anattā',
    pali: 'Anattā',
    vietnamese: 'Vô ngã',
    category: 'Tam Tướng',
    definition: 'Đặc tính không có cốt lõi, không có một linh hồn hay cái Ta (Attā) trường tồn, độc lập làm chủ thể tự thân bên trong thân tâm ngũ uẩn.',
    aliases: ['Vô ngã', 'Tính vô ngã']
  },
  {
    term: 'Tilakkhaṇa',
    pali: 'Tilakkhaṇa',
    vietnamese: 'Tam Tướng (Vô thường, Khổ, Vô ngã)',
    category: 'Tam Tướng',
    definition: 'Ba đặc tính phổ quát chi phối toàn bộ vạn pháp hữu vi trong vũ trụ: Vô thường (Anicca), Khổ (Dukkha), và Vô ngã (Anattā).',
    aliases: ['Tam Tướng', 'Ba pháp ấn']
  },

  // 3. Bát Chánh Đạo
  {
    term: 'Ariya Aṭṭhaṅgika Magga',
    pali: 'Ariya Aṭṭhaṅgika Magga',
    vietnamese: 'Bát Chánh Đạo',
    category: 'Bát Chánh Đạo',
    definition: 'Tám chi phần chân chánh dẫn tới giải thoát: Chánh kiến, Chánh tư duy, Chánh ngữ, Chánh nghiệp, Chánh mạng, Chánh tinh tấn, Chánh niệm, Chánh định.',
    aliases: ['Bát Chánh Đạo', 'Bát Thánh Đạo']
  },
  {
    term: 'Sammā-diṭṭhi',
    pali: 'Sammā-diṭṭhi',
    vietnamese: 'Chánh Kiến',
    category: 'Bát Chánh Đạo',
    definition: 'Sự hiểu biết và cái thấy như thật về Tứ Thánh Đế, quy luật Nhân quả nghiệp báo và Tam Tướng của vạn pháp.',
    aliases: ['Chánh Kiến', 'Sammā diṭṭhi']
  },
  {
    term: 'Sammā-saṅkappa',
    pali: 'Sammā-saṅkappa',
    vietnamese: 'Chánh Tư Duy',
    category: 'Bát Chánh Đạo',
    definition: 'Suy nghĩ chân chánh, hướng tâm đến Ly dục (Nekkhamma), Vô sân (Vyāpāda-vūpasama) và Bất hại (Avihiṃsā).',
    aliases: ['Chánh Tư Duy', 'Sammā saṅkappa']
  },
  {
    term: 'Sammā-vācā',
    pali: 'Sammā-vācā',
    vietnamese: 'Chánh Ngữ',
    category: 'Bát Chánh Đạo',
    definition: 'Lời nói chân thật, hòa ái, hữu ích; tránh nói dối, nói lời đâm thọc chia rẽ, nói lời thô ác và nói lời phù phiếm.',
    aliases: ['Chánh Ngữ', 'Sammā vācā']
  },
  {
    term: 'Sammā-kammanta',
    pali: 'Sammā-kammanta',
    vietnamese: 'Chánh Nghiệp',
    category: 'Bát Chánh Đạo',
    definition: 'Hành động thân thể chân chánh; từ bỏ sát sinh, từ bỏ trộm cắp, từ bỏ tà dâm.',
    aliases: ['Chánh Nghiệp', 'Sammā kammanta']
  },
  {
    term: 'Sammā-ājīva',
    pali: 'Sammā-ājīva',
    vietnamese: 'Chánh Mạng',
    category: 'Bát Chánh Đạo',
    definition: 'Nuôi mạng chân chánh; mưu sinh bằng nghề nghiệp lương thiện, không làm tổn hại đến sự sống của muôn loài chúng sinh.',
    aliases: ['Chánh Mạng', 'Sammā ājīva']
  },
  {
    term: 'Sammā-vāyāma',
    pali: 'Sammā-vāyāma',
    vietnamese: 'Chánh Tinh Tấn (Tứ Chánh Cần)',
    category: 'Bát Chánh Đạo',
    definition: 'Nỗ lực ngăn ngừa điều ác chưa sinh, diệt trừ điều ác đã sinh, phát triển điều thiện chưa sinh, và duy trì điều thiện đã sinh.',
    aliases: ['Chánh Tinh Tấn', 'Sammā vāyāma']
  },
  {
    term: 'Sammā-sati',
    pali: 'Sammā-sati',
    vietnamese: 'Chánh Niệm (Tứ Niệm Xứ)',
    category: 'Bát Chánh Đạo',
    definition: 'Sự tỉnh thức và ghi nhận rõ ràng trên 4 đối tượng: Thân (Kāya), Thọ (Vedanā), Tâm (Citta), và Pháp (Dhamma).',
    aliases: ['Chánh Niệm', 'Sammā sati', 'Sati']
  },
  {
    term: 'Sammā-samādhi',
    pali: 'Sammā-samādhi',
    vietnamese: 'Chánh Định',
    category: 'Bát Chánh Đạo',
    definition: 'Tâm an trú vững chắc, gom tụ không xao lãng trên đối tượng thiện lành, thành tựu 4 tầng Thiền Sắc Giới (Rūpa Jhāna).',
    aliases: ['Chánh Định', 'Sammā samādhi', 'Samādhi']
  },

  // 4. Ngũ Uẩn (Pañcakkhandhā)
  {
    term: 'Pañcakkhandhā',
    pali: 'Pañcakkhandhā',
    vietnamese: 'Năm Uẩn / Ngũ Uẩn',
    category: 'Ngũ Uẩn',
    definition: 'Năm nhóm yếu tố cấu thành danh sắc của một sinh mệnh: Sắc (Rūpa), Thọ (Vedanā), Tưởng (Saññā), Hành (Saṅkhāra), và Thức (Viññāṇa).',
    aliases: ['Ngũ uẩn', 'Năm uẩn', 'Khandha']
  },
  {
    term: 'Rūpa',
    pali: 'Rūpa',
    vietnamese: 'Sắc Uẩn / Sắc pháp',
    category: 'Ngũ Uẩn',
    definition: 'Toàn bộ yếu tố vật chất, thân thể và các giác quan được cấu thành từ 4 đại chủng (Đất, Nước, Lửa, Gió).',
    aliases: ['Sắc uẩn', 'Sắc pháp']
  },
  {
    term: 'Vedanā',
    pali: 'Vedanā',
    vietnamese: 'Thọ Uẩn / Cảm thọ',
    category: 'Ngũ Uẩn',
    definition: 'Cảm giác nhận lãnh đối tượng: Thọ lạc (dễ chịu), Thọ khổ (khó chịu), hoặc Thọ bất khổ bất lạc (xả thọ / trung tính).',
    aliases: ['Thọ uẩn', 'Cảm thọ']
  },
  {
    term: 'Saññā',
    pali: 'Saññā',
    vietnamese: 'Tưởng Uẩn / Tri giác',
    category: 'Ngũ Uẩn',
    definition: 'Chức năng nhận diện, ghi nhớ và dán nhãn cho các đối tượng thông qua kinh nghiệm và ký ức quá khứ.',
    aliases: ['Tưởng uẩn', 'Tri giác']
  },
  {
    term: 'Saṅkhāra',
    pali: 'Saṅkhāra',
    vietnamese: 'Hành Uẩn / Các hành tạo tác',
    category: 'Ngũ Uẩn',
    definition: 'Các trạng thái tâm lý tạo tác (50 tâm sở hành) như tác ý, tham, sân, từ bi, tinh tấn... định hình nghiệp thiện hoặc ác.',
    aliases: ['Hành uẩn', 'Các hành']
  },
  {
    term: 'Viññāṇa',
    pali: 'Viññāṇa',
    vietnamese: 'Thức Uẩn / Tâm thức',
    category: 'Ngũ Uẩn',
    definition: 'Khả năng nhận biết đơn thuần đối tượng thông qua 6 giác quan (Nhãn thức, Nhĩ thức, Tỷ thức, Thiệt thức, Thân thức, Ý thức).',
    aliases: ['Thức uẩn', 'Tâm thức']
  },
  {
    term: 'Upādānakkhandhā',
    pali: 'Upādānakkhandhā',
    vietnamese: 'Ngũ Thủ Uẩn',
    category: 'Ngũ Uẩn',
    definition: 'Năm uẩn khi bị dính mắc và nắm bắt bởi Ái và Thủ (chấp ngã), là cội nguồn của mọi khổ đau.',
    aliases: ['Ngũ thủ uẩn', 'Năm thủ uẩn']
  },

  // 5. Thập Nhị Duyên Khởi (Paṭiccasamuppāda)
  {
    term: 'Paṭiccasamuppāda',
    pali: 'Paṭiccasamuppāda',
    vietnamese: 'Thập Nhị Nhân Duyên / Duyên Khởi',
    category: 'Duyên Khởi',
    definition: 'Quy luật duyên sinh tương tác của 12 chi phần giải thích cách luân hồi khổ đau vận hành và cách thức đoạn tận khổ đau.',
    aliases: ['Thập Nhị Nhân Duyên', 'Duyên Khởi', 'Lý duyên khởi']
  },
  {
    term: 'Avijjā',
    pali: 'Avijjā',
    vietnamese: 'Vô Minh',
    category: 'Duyên Khởi',
    definition: 'Sự không thấu hiểu Tứ Thánh Đế, Tam Tướng và Duyên Khởi; chi phần đầu tiên khởi động toàn bộ tiến trình khổ đau luân hồi.',
    aliases: ['Vô minh', 'Si phần']
  },
  {
    term: 'Nāmarūpa',
    pali: 'Nāmarūpa',
    vietnamese: 'Danh Sắc',
    category: 'Duyên Khởi',
    definition: 'Tổ hợp gồm phần Tâm lý / Tinh thần (Danh: Thọ, Tưởng, Tác ý, Xúc, Tác dụng) và Thể xác / Vật chất (Sắc).',
    aliases: ['Danh Sắc', 'Danh và sắc']
  },
  {
    term: 'Saḷāyatana',
    pali: 'Saḷāyatana',
    vietnamese: 'Lục Nhập / Lục Căn',
    category: 'Duyên Khởi',
    definition: 'Sáu giác quan tiếp nhận thế giới: Mắt (Mắt), Tai (Nhĩ), Mũi (Tỷ), Lưỡi (Thiệt), Thân (Thân), và Ý (Ý).',
    aliases: ['Lục Nhập', 'Lục căn', 'Sáu nội xứ']
  },
  {
    term: 'Phassa',
    pali: 'Phassa',
    vietnamese: 'Xúc',
    category: 'Duyên Khởi',
    definition: 'Sự hội tụ của 3 yếu tố: Căn (Giác quan) + Cảnh (Đối tượng) + Thức (Sự nhận biết), khởi sinh cảm thọ.',
    aliases: ['Xúc', 'Sự xúc chạm']
  },
  {
    term: 'Taṇhā',
    pali: 'Taṇhā',
    vietnamese: 'Ái Dục / Tham Ái',
    category: 'Duyên Khởi',
    definition: 'Sự khao khát, thèm muốn, bám chặt vào cảm thọ dễ chịu (Dục ái, Hữu ái, Phi hữu ái), là sợi dây trói buộc trong luân hồi.',
    aliases: ['Ái dục', 'Tham ái', 'Khát ái']
  },
  {
    term: 'Upādāna',
    pali: 'Upādāna',
    vietnamese: 'Thủ Chấp',
    category: 'Duyên Khởi',
    definition: 'Mức độ nắm giữ và bám chặt mãnh liệt của tâm vào Dục lạc, Tà kiến, Giới cấm thủ, và Ngã chấp.',
    aliases: ['Thủ chấp', 'Chấp thủ', 'Thủ']
  },
  {
    term: 'Bhava',
    pali: 'Bhava',
    vietnamese: 'Hữu / Tiến trình tái sinh',
    category: 'Duyên Khởi',
    definition: 'Bao gồm Nghiệp hữu (Kammabhava - tạo tác nghiệp) và Tái sinh hữu (Upapattibhava - cảnh giới sinh ra trong 31 cõi).',
    aliases: ['Hữu', 'Cõi hữu']
  },
  {
    term: 'Jāti',
    pali: 'Jāti',
    vietnamese: 'Sinh / Tái sinh',
    category: 'Duyên Khởi',
    definition: 'Sự xuất hiện của các uẩn, sự thành tựu của các căn trong một cảnh giới đời sống mới.',
    aliases: ['Sinh', 'Tái sinh']
  },
  {
    term: 'Jarāmaraṇa',
    pali: 'Jarāmaraṇa',
    vietnamese: 'Lão Tử / Già và Chết',
    category: 'Duyên Khởi',
    definition: 'Sự suy tàn của các căn (Già) và sự chấm dứt của mạng quyền ngũ uẩn (Chết), kèm theo sầu, bi, khổ, ưu, não.',
    aliases: ['Lão Tử', 'Già chết']
  },

  // 6. Thánh Quả & Kiết Sử
  {
    term: 'Sotāpanna',
    pali: 'Sotāpanna',
    vietnamese: 'Bậc Dự Lưu / Tu-đà-hoàn',
    category: 'Thánh Quả',
    definition: 'Bậc Thánh quả thứ nhất đã nhập vào dòng Thánh, đoạn tận 3 kiết sử đầu (Thân kiến, Hoài nghi, Giới cấm thủ), tái sinh tối đa 7 kiếp.',
    aliases: ['Dự Lưu', 'Tu-đà-hoàn', 'Sotāpatti']
  },
  {
    term: 'Sakadāgāmī',
    pali: 'Sakadāgāmī',
    vietnamese: 'Bậc Nhất Lai / Tư-đà-hàm',
    category: 'Thánh Quả',
    definition: 'Bậc Thánh quả thứ hai, đã làm muội lược (suy yếu) Dục ái và Sân hận, chỉ còn trở lại cõi người nhiều nhất 1 lần.',
    aliases: ['Nhất Lai', 'Tư-đà-hàm']
  },
  {
    term: 'Anāgāmī',
    pali: 'Anāgāmī',
    vietnamese: 'Bậc Bất Lai / A-na-hàm',
    category: 'Thánh Quả',
    definition: 'Bậc Thánh quả thứ ba, đã đoạn tận hoàn toàn 5 hạ phần kiết sử (kể cả Dục ái và Sân hận), sẽ đắc A-la-hán tại cõi Tịnh Cư Thiên.',
    aliases: ['Bất Lai', 'A-na-hàm']
  },
  {
    term: 'Arahant',
    pali: 'Arahant',
    vietnamese: 'Bậc A-la-hán / Ứng Cúng',
    category: 'Thánh Quả',
    definition: 'Bậc Thánh quả tối cao đã tận diệt cả 10 kiết sử, dập tắt mọi lậu hoặc (Āsava), chấm dứt hoàn toàn bánh xe luân hồi sinh tử.',
    aliases: ['A-la-hán', 'Alahan', 'Arahat']
  },
  {
    term: 'Sakkāyadiṭṭhi',
    pali: 'Sakkāyadiṭṭhi',
    vietnamese: 'Thân Kiến',
    category: 'Kiết Sử',
    definition: 'Sự nhận lầm và tin tưởng vững chắc rằng có một cái Ta (Bản ngã) trường tồn đồng nhất với một trong 5 uẩn.',
    aliases: ['Thân Kiến', 'Tà kiến về thân']
  },
  {
    term: 'Vicikicchā',
    pali: 'Vicikicchā',
    vietnamese: 'Hoài Nghi',
    category: 'Kiết Sử',
    definition: 'Sự nghi ngờ, do dự, thiếu niềm tin chánh tín vào Phật, Pháp, Tăng, Giới luật và Giáo lý Duyên Khởi.',
    aliases: ['Hoài Nghi', 'Nghi ngờ']
  },
  {
    term: 'Sīlabbataparāmāsa',
    pali: 'Sīlabbataparāmāsa',
    vietnamese: 'Giới Cấm Thủ',
    category: 'Kiết Sử',
    definition: 'Sự chấp chặt vào các nghi lễ, hủ tục hoặc hạnh tu khổ hạnh sai lầm với niềm tin mù quáng rằng chúng đem lại giải thoát.',
    aliases: ['Giới Cấm Thủ', 'Chấp thủ nghi thức']
  },
  {
    term: 'Saṃyojana',
    pali: 'Saṃyojana',
    vietnamese: 'Kiết Sử / Dây Trói Buộc',
    category: 'Kiết Sử',
    definition: 'Mười sợi dây tâm lý trói buộc tâm thức chúng sinh chặt chẽ vào vòng luân hồi sinh tử (Saṃsāra).',
    aliases: ['Kiết Sử', '10 Kiết sử']
  },

  // 7. Cốt Lõi Vi Diệu Pháp & Giải Thoát
  {
    term: 'Nibbāna',
    pali: 'Nibbāna',
    vietnamese: 'Niết-Bàn / Tịch Diệt',
    category: 'Chân Lý Tối Thượng',
    definition: 'Pháp Vô Vi tối thượng (Asaṅkhata Dhamma), sự dập tắt hoàn toàn ba ngọn lửa Tham, Sân, Si và chấm dứt mọi khổ não luân hồi.',
    aliases: ['Niết-bàn', 'Nirvana', 'Tịch diệt']
  },
  {
    term: 'Paramattha',
    pali: 'Paramattha',
    vietnamese: 'Pháp Chân Đế / Thực Tại Tối Hậu',
    category: 'Vi Diệu Pháp',
    definition: 'Thực tại tối hậu không thể chia chẻ thêm, gồm 4 pháp: Tâm (Citta), Tâm sở (Cetasika), Sắc pháp (Rūpa) và Niết-bàn (Nibbāna).',
    aliases: ['Chân Đế', 'Paramattha Dhamma']
  },
  {
    term: 'Sammuti',
    pali: 'Sammuti',
    vietnamese: 'Pháp Tục Đế / Khái Niệm Chế Định',
    category: 'Vi Diệu Pháp',
    definition: 'Chân lý chế định theo quy ước thế gian (như tên gọi, con người, đồ vật, xe cộ), không có thực tính tự nhiên riêng biệt.',
    aliases: ['Tục Đế', 'Chế định']
  },
  {
    term: 'Citta',
    pali: 'Citta',
    vietnamese: 'Tâm / Tâm Vương',
    category: 'Vi Diệu Pháp',
    definition: 'Yếu tố nhận biết đối tượng (cảnh); gồm 89 hoặc 121 loại tâm phân bố trong các cõi sống.',
    aliases: ['Tâm', 'Tâm vương']
  },
  {
    term: 'Cetasika',
    pali: 'Cetasika',
    vietnamese: 'Tâm Sở / Thuộc tính của Tâm',
    category: 'Vi Diệu Pháp',
    definition: '52 yếu tố tâm lý cùng sinh, cùng diệt, cùng bắt một cảnh và cùng nương một căn với Tâm.',
    aliases: ['Tâm Sở', 'Tâm hành']
  },
  {
    term: 'Kamma',
    pali: 'Kamma',
    vietnamese: 'Nghiệp',
    category: 'Quy Luật Vũ Trụ',
    definition: 'Hành động được khởi sinh từ Tác ý (Cetanā) qua Thân, Khẩu, hoặc Ý; tạo ra năng lực chiêu cảm quả báo tương ứng.',
    aliases: ['Nghiệp', 'Hành nghiệp']
  },
  {
    term: 'Vipāka',
    pali: 'Vipāka',
    vietnamese: 'Quả Báo / Nghiệp Quả',
    category: 'Quy Luật Vũ Trụ',
    definition: 'Kết quả chín muồi sinh ra từ các hành động nghiệp thiện hoặc bất thiện đã gây tạo trong quá khứ.',
    aliases: ['Quả báo', 'Nghiệp quả', 'Dị thục quả']
  },

  // 8. Thiền Định & Thực Hành (Paṭipatti)
  {
    term: 'Samatha',
    pali: 'Samatha',
    vietnamese: 'Thiền Định / Thiền Chỉ',
    category: 'Thiền Định',
    definition: 'Phương pháp tu tập làm lắng dịu tâm trí, an tịnh các triền cái, giúp tâm tập trung nhất điểm đạt tới các tầng Thiền (Jhāna).',
    aliases: ['Thiền Định', 'Thiền Chỉ', 'Chỉ quán']
  },
  {
    term: 'Vipassanā',
    pali: 'Vipassanā',
    vietnamese: 'Thiền Tuệ / Minh Sát Tuệ',
    category: 'Thiền Định',
    definition: 'Phương pháp thiền quán chiếu trực tiếp danh sắc trong hiện tại để thấu suốt bản chất Tam Tướng (Vô thường, Khổ, Vô ngã) và đắc Thánh đạo.',
    aliases: ['Thiền Tuệ', 'Minh Sát', 'Vipassana']
  },
  {
    term: 'Satipaṭṭhāna',
    pali: 'Satipaṭṭhāna',
    vietnamese: 'Tứ Niệm Xứ',
    category: 'Thiền Định',
    definition: 'Bốn nền tảng thiết lập chánh niệm duy nhất đưa đến giải thoát: Quán Thân (Kāya), Quán Thọ (Vedanā), Quán Tâm (Citta), và Quán Pháp (Dhamma).',
    aliases: ['Tứ Niệm Xứ', 'Thiền Tứ Niệm Xứ']
  },
  {
    term: 'Mettā',
    pali: 'Mettā',
    vietnamese: 'Tâm Từ / Lòng Từ Ái',
    category: 'Tứ Vô Lượng Tâm',
    definition: 'Ước nguyện chân thành và không biên giới mong cho tất cả chúng sinh được an vui, thoát khỏi hận thù và hoạn nạn.',
    aliases: ['Tâm Từ', 'Từ Bi', 'Lòng Từ']
  },
  {
    term: 'Karuṇā',
    pali: 'Karuṇā',
    vietnamese: 'Tâm Bi',
    category: 'Tứ Vô Lượng Tâm',
    definition: 'Lòng trắc ẩn và ước muốn cứu giúp chúng sinh đang chìm đắm trong đau khổ.',
    aliases: ['Tâm Bi', 'Lòng Bi']
  },
  {
    term: 'Muditā',
    pali: 'Muditā',
    vietnamese: 'Tâm Hỷ',
    category: 'Tứ Vô Lượng Tâm',
    definition: 'Niềm vui mừng chân thành trước sự thành công và hạnh phúc của người khác, diệt trừ lòng đố kỵ, ganh ghét.',
    aliases: ['Tâm Hỷ', 'Tùy hỷ']
  },
  {
    term: 'Upekkhā',
    pali: 'Upekkhā',
    vietnamese: 'Tâm Xả',
    category: 'Tứ Vô Lượng Tâm',
    definition: 'Tâm thái thanh tịnh, bình thản và sáng suốt trước 8 ngọn gió đời (Được/Mất, Danh/Nhục, Khen/Chê, Vui/Khổ).',
    aliases: ['Tâm Xả', 'Xả ly']
  },
  {
    term: 'Ehipassiko',
    pali: 'Ehipassiko',
    vietnamese: 'Đến để mà thấy',
    category: 'Đặc Tính Pháp',
    definition: 'Đặc tính của Giáo pháp Đức Phật: Khuyến khích người tìm hiểu hãy đến tự thân khảo nghiệm, quán sát thực chứng chứ không tin mù quáng.',
    aliases: ['Đến để mà thấy', 'Ehipassiko']
  },
  {
    term: 'Yoniso Manasikāra',
    pali: 'Yoniso Manasikāra',
    vietnamese: 'Như Lý Tác Ý',
    category: 'Tu Tập',
    definition: 'Sự hướng tâm đúng đắn, quán sát sâu sắc đến tận cội nguồn bản chất của vạn pháp theo quy luật duyên khởi.',
    aliases: ['Như Lý Tác Ý', 'Tác ý đúng đắn']
  },

  // 8. Tứ Vô Lượng Tâm & Bát Phong
  {
    term: 'Brahmavihāra',
    pali: 'Brahmavihāra',
    vietnamese: 'Tứ Vô Lượng Tâm / Phạm Trú',
    category: 'Tứ Vô Lượng Tâm',
    definition: 'Bốn trạng thái tâm cao thượng vô lượng giải thoát: Từ (Mettā), Bi (Karuṇā), Hỷ (Muditā), và Xả (Upekkhā).',
    aliases: ['Tứ Vô Lượng Tâm', 'Phạm Trú', 'Bốn Tâm Vô Lượng']
  },
  {
    term: 'Lokadhamma',
    pali: 'Lokadhamma',
    vietnamese: 'Bát Phong / Tám Ngọn Gió Đời',
    category: 'Pháp Thế Gian',
    definition: 'Tám pháp thế gian biến động không ngừng: Được - Mất, Danh thơm - Tiếng xấu, Ca ngợi - Chê bai, Lạc thú - Đau khổ.',
    aliases: ['Bát Phong', 'Tám ngọn gió đời', 'Pháp thế gian']
  },

  // 9. Thiền Quán Hơi Thở & Tỉnh Giác
  {
    term: 'Ānāpānasati',
    pali: 'Ānāpānasati',
    vietnamese: 'Quán Niệm Hơi Thở',
    category: 'Thiền Định & Thiền Tuệ',
    definition: 'Phương pháp thiền định và tuệ quán cốt lõi qua 16 bước theo dõi hơi thở vào - ra từ thô đến tế, đưa tới an tịnh và giải thoát.',
    aliases: ['Quán Niệm Hơi Thở', 'Niệm hơi thở', 'Anapanasati']
  },
  {
    term: 'Nīvaraṇa',
    pali: 'Pañca Nīvaraṇa',
    vietnamese: 'Năm Triền Cái',
    category: 'Chướng Ngại Thiền',
    definition: 'Năm chướng ngại ngăn che tâm định và tuệ giác: Tham dục (Kāmacchanda), Sân hận (Byāpāda), Hôn trầm thụy miên (Thīna-middha), Trạo cử hối quá (Uddhacca-kukkucca), Hoài nghi (Vicikicchā).',
    aliases: ['Năm Triền Cái', 'Triền cái', 'Nivarana']
  },
  {
    term: 'Sampajañña',
    pali: 'Sampajañña',
    vietnamese: 'Tỉnh Giác',
    category: 'Thiền Tuệ',
    definition: 'Sự hiểu biết rõ ràng, sáng suốt về bản chất và mục đích của mọi hành động thân - khẩu - ý trong từng giây phút hiện tại.',
    aliases: ['Tỉnh Giác', 'Chánh tri', 'Sampajanna']
  },

  // 10. Tiến Trình Tâm Thức & Thanh Tịnh Đạo
  {
    term: 'Citta-vīthi',
    pali: 'Citta-vīthi',
    vietnamese: 'Tiến Trình Tâm Thức / Lộ Trình Tâm',
    category: 'Vi Diệu Pháp',
    definition: 'Chuỗi diễn tiến của 17 sát-na tâm liên tục khi giác quan tiếp nhận đối tượng trần cảnh trong Vi Diệu Pháp (Abhidhamma).',
    aliases: ['Tiến trình tâm', 'Lộ trình tâm', 'Citta vithi']
  },
  {
    term: 'Visuddhi',
    pali: 'Satta Visuddhi',
    vietnamese: 'Thất Thanh Tịnh',
    category: 'Thanh Tịnh Đạo',
    definition: 'Bảy giai đoạn thanh lọc giới hạnh và tuệ giác theo bộ luận Visuddhimagga (Thanh Tịnh Đạo) để đạt đến Niết-bàn rốt ráo.',
    aliases: ['Thất Thanh Tịnh', 'Bảy giai đoạn thanh tịnh', 'Visuddhi']
  },
  {
    term: 'Vipassanā-ñāṇa',
    pali: 'Solasa Vipassanā-ñāṇa',
    vietnamese: 'Mười Sáu Tầng Tuệ Minh Sát',
    category: 'Thiền Tuệ',
    definition: 'Tiến trình 16 nấc thang tuệ giác trực nhận Tam Tướng trên danh sắc đưa hành giả từ phàm phu chứng đắc Thánh Đạo Thánh Quả.',
    aliases: ['16 Tuệ Minh Sát', 'Tuệ Minh Sát', 'Vipassana nana']
  },
  {
    term: 'Nimitta',
    pali: 'Nimitta',
    vietnamese: 'Thiền Tướng / Ấn Chứng Thiền',
    category: 'Thiền Định',
    definition: 'Dấu hiệu quang tướng hoặc cảm giác tâm linh xuất hiện khi tâm đạt đến mức độ định sâu sắc trong thiền định Samatha.',
    aliases: ['Thiền Tướng', 'Ấn chứng quang tướng', 'Quang tướng']
  },

  // 11. Các Bản Kinh Điển Trọng Yếu
  {
    term: 'Mahāmaṅgala',
    pali: 'Mahāmaṅgala Sutta',
    vietnamese: 'Kinh Điềm Lành Hạnh Phúc',
    category: 'Kinh Tạng',
    definition: 'Bản kinh trong Tiểu Bộ Kinh chỉ dạy 38 pháp điềm lành tạo nên hạnh phúc chân thật và tối thượng từ thế gian đến xuất thế gian.',
    aliases: ['Kinh Điềm Lành', 'Kinh Hạnh Phúc', 'Mahamangala Sutta']
  },
  {
    term: 'Bhaddekaratta',
    pali: 'Bhaddekaratta Sutta',
    vietnamese: 'Kinh Người Biết Sống Một Mình',
    category: 'Kinh Tạng',
    definition: 'Bài kinh trong Trung Bộ dạy cách an trú tâm trong hiện tại, không tiếc nuối quá khứ và không mơ tưởng tương lai.',
    aliases: ['Kinh Người Biết Sống Một Mình', 'Bhaddekaratta']
  },
  {
    term: 'Alagaddūpama',
    pali: 'Alagaddūpama Sutta',
    vietnamese: 'Kinh Ví Dụ Con Rắn & Chiếc Bè',
    category: 'Kinh Tạng',
    definition: 'Bài kinh trong Trung Bộ ví dụ về nguy hại của việc chấp thủ giáo pháp như bắt rắn đằng đuôi, và giáo pháp chỉ như chiếc bè qua sông.',
    aliases: ['Kinh Ví Dụ Con Rắn', 'Kinh Chiếc Bè', 'Alagaddupama']
  }
];

export function findPaliTermDefinition(rawTerm: string): PaliGlossaryEntry | undefined {
  if (!rawTerm) return undefined;
  const clean = rawTerm.trim().toLowerCase();
  return PALI_GLOSSARY.find(entry => {
    if (entry.term.toLowerCase() === clean) return true;
    if (entry.pali.toLowerCase() === clean) return true;
    if (entry.vietnamese.toLowerCase() === clean) return true;
    if (entry.aliases && entry.aliases.some(a => a.toLowerCase() === clean)) return true;
    return false;
  });
}
