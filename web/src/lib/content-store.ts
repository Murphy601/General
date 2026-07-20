import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentType, GeneratedContent } from './types';

const CONTENT_DIR = join(process.cwd(), 'data', 'content');
const INDEX_PATH = join(CONTENT_DIR, 'index.json');

function ensureDir() {
  mkdirSync(CONTENT_DIR, { recursive: true });
}

function readIndex(): GeneratedContent[] {
  ensureDir();
  if (!existsSync(INDEX_PATH)) return [];
  return JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
}

function writeIndex(items: GeneratedContent[]) {
  ensureDir();
  writeFileSync(INDEX_PATH, JSON.stringify(items, null, 2));
}

export function listContent(filters?: { type?: ContentType; grade?: string; subject?: string }) {
  let items = readIndex();
  if (filters?.type) items = items.filter((i) => i.type === filters.type);
  if (filters?.grade) items = items.filter((i) => i.topic.grade === filters.grade);
  if (filters?.subject) items = items.filter((i) => i.topic.subject.toLowerCase().includes(filters.subject!.toLowerCase()));
  return items.sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt));
}

export function getContent(id: string): GeneratedContent | undefined {
  const filePath = join(CONTENT_DIR, `${id}.json`);
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  }
  return readIndex().find((i) => i.id === id);
}

export function saveContent(content: GeneratedContent) {
  ensureDir();
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  const index = readIndex().filter((i) => i.id !== content.id);
  index.unshift({ ...content, body: content.body.slice(0, 300) + (content.body.length > 300 ? '…' : '') });
  writeIndex(index);
}

export function seedSamplesIfEmpty() {
  if (readIndex().length > 0) return;
  const samples: GeneratedContent[] = [
    {
      id: 'sample-notes-g4-ag',
      type: 'notes',
      title: 'Grade 4 Agriculture — Crop Production Basics',
      topic: { grade: 'grade-4', gradeLabel: 'Grade 4', subject: 'Agriculture', strand: 'Crop Production', subStrand: 'Land Preparation' },
      body: '## Learning Notes (Sample)\n\nThis is a placeholder showing how AI-generated notes will appear after you use the Content Studio.\n\n**What learners will understand:**\n- Why farmers prepare land before planting\n- Simple tools used in Kenyan farms\n- Safety and cooperation when working on the shamba\n\n**Local example:** On a small farm in Nyeri, a family clears weeds, loosens soil, and adds compost before planting maize.\n\n> Generate real notes from KICD curriculum using **Studio → Learning Notes**.',
      metadata: { createdAt: new Date().toISOString(), wordCount: 120, reviewed: false, access: 'free' },
      sources: [],
    },
    {
      id: 'sample-exam-g4-ag',
      type: 'exam',
      title: 'Grade 4 Agriculture — Term 1 Assessment (Sample)',
      topic: { grade: 'grade-4', gradeLabel: 'Grade 4', subject: 'Agriculture', strand: 'Crop Production' },
      body: '## End of Term Assessment (Sample)\n\n**Time:** 1 hour | **Total:** 50 marks\n\n### Section A — Multiple Choice (20 marks)\n\n1. The best reason for preparing land is…\n2. Which tool is used for digging?\n\n### Section B — Structured (30 marks)\n\n1. Explain three steps in land preparation. (6 marks)\n\n> Generate a full exam with marking scheme via **Studio → Termly Exam**.',
      metadata: {
        createdAt: new Date().toISOString(),
        wordCount: 80,
        reviewed: false,
        access: 'paid',
        priceKes: 100,
        markingScheme: 'Sample marking scheme will appear here after generation.',
      },
      sources: [],
    },
    {
      id: 'sample-video-g4-ag',
      type: 'video-script',
      title: 'Preparing the Shamba — 5 min Lesson (Sample)',
      topic: { grade: 'grade-4', gradeLabel: 'Grade 4', subject: 'Agriculture', strand: 'Crop Production', subStrand: 'Land Preparation' },
      body: 'Video script sample — use Studio to generate a full 5-minute script with hook, lesson, quiz, and outro.',
      metadata: {
        createdAt: new Date().toISOString(),
        wordCount: 20,
        reviewed: false,
        access: 'subscription' as const,
        videoUrl: '',
        scriptSections: [
          { time: '0:00', label: 'Hook', content: 'Habari Grade 4! Have you ever helped prepare soil for planting?', visualCue: 'Kenyan child on a small farm' },
          { time: '0:45', label: 'Lesson', content: 'Step 1: Clear weeds. Step 2: Loosen soil. Step 3: Add manure.', visualCue: 'Animation of land preparation' },
          { time: '3:00', label: 'Quiz', content: 'True or False: We should plant before clearing weeds?', visualCue: 'Quiz overlay' },
          { time: '4:15', label: 'Outro', content: 'Download the worksheet and practice at home. Kwaheri!', visualCue: 'Smiling learner' },
        ],
      },
      sources: [],
    },
  ];
  for (const s of samples) saveContent(s);
}
