# Mandarin Grade 4: notes for the human checker

## Structure decisions
- The design has 9 themes and 27 sub-strands (1.1-1.9 Listening and Speaking, 2.1-2.9 Reading, 3.1-3.9 Writing). Manifest numbers (1.1, 1.3, 1.5, 1.7, 1.8, 2.1, ...) are all real sub-strand numbers, so nothing is retired (no retire.json). Missing sub-strands (1.2, 1.4, 1.6, 1.9, 2.2, 2.6, 2.8, 3.3, 3.4, 3.6, 3.8) were added.
- 4.1 "Exhibitions and Showcase" (6 lessons in the summary table, but the design gives no outcomes) is a review/showcase lesson. The number 4.1 is our own choice.
- topicName follows the pattern "<Sub strand> (<Theme>)" because the design repeats names like "Reading Aloud".

## Please verify (language)
- 橄榄菜 gǎnlǎncài: the design lists it as a vegetable. It is normally a salty preserved green (olive vegetable); glossed as such. Pinyin is certain, the exact English gloss is less so.
- The design says "Jumamosi vs 星期一" for the Kiswahili/Chinese day comparison. Jumamosi is Saturday, so this looks like a mismatch. The lesson (1.4) teaches that Swahili counts days from Saturday (Jumatatu = Monday, tatu = three) and Chinese counts from Monday.
- The design's "太阳 and 代养" word game (2.8) is OCR noise. It was replaced with look-alike characters 大/太/天 and 人/入/八.
- Tone changes: 你好 nǐ hǎo (third-tone rule) is taught. 一 yí and 不 bú before a falling tone appear once each (请再说一遍 qǐng zài shuō yí biàn, 太阳不大 tàiyáng bú dà) with only a brief note. Other places write the base tone (e.g. 星期一 xīngqīyī).
- 个 written gè (sān gè fángjiān, liǎng gè ěrduo). Some books write it neutral (ge).
- Measure words: 两只眼睛, 两个耳朵, 一个嘴巴, 五口人 are standard but a teacher may prefer other classifiers.
- 哪儿 given as nǎr (not nǎ'er); 女儿 as nǚ'ér.
- 同学们, 早上, 昨天, 前面, 里, 没有, 洪水 hóngshuǐ, 干旱 gānhàn, 饼干 bǐnggān, 洗手, 刷牙, 摸: added beyond the design's word lists; pinyin is believed certain.
- Kiswahili birthday greeting "Heri ya siku ya kuzaliwa".
- Songs: only tunes are suggested (Twinkle Twinkle, Head Shoulders Knees and Toes, Happy Birthday). No lyrics copied. The tongue twister 吃葡萄不吐葡萄皮 is from the design; 妈妈骑马 is a traditional rhyme.
- Chinese punctuation is shown with ASCII ! ? and , in the lessons (full-width forms are mentioned in 3.1).
- Wording: "星期天 (also 星期日 / 周日)" taught; the design uses 星期天, 星期日 and 周日.

## Please verify (strokes)
- Stroke counts: 一1 二2 三3 四5 五4 六4 七2 八2 九2 十2 人2 大3 口3 日4 手4 头5 耳6 目5 好6 你7 我7 叫5 呢8 妈6 爸8 哥10 姐8 弟7 妹8 家10 这7 是9 那6 床7 门3 上3 下3 在6 电5 房8 祝9 生5 快7 乐5 茶9 米6 肉6 饭7 牛4 鸡7 饼9 果8 吃6 喝12 云4 风4 雨8 雪11 太4 阳6 去5 校10 学8 星9 期12 左5 右5 边5 旁10 面9 花7 园7 户4 眼11 脚11. A stroke-order reference should confirm these.
- Stroke-order figures (十, 人, 大, 口, 日, 手, 头, 左, 右, 一二三五六) are simplified schematic drawings. Shapes are approximate and stroke numbers show order only.
- 右 begins with 撇 then 横; 左 begins with 横 then 撇 (standard).

## Figures
- 23 figures. The SVG text contains Chinese characters, so the viewer needs a CJK-capable system font (font-family="sans-serif" fallback is used).
- Figure 1.1 tone diagram is idealised pitch contours, not measured.

## Bank
- 557 MCQ and 239 short items. A large share are vocabulary recall generated from a checked word table, plus hand-written concept, fill-in-the-blank and sentence items. Topics were assigned to lessons that actually contain the word.
